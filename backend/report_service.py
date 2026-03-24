import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import traceback
from supabase import Client
from pydantic import BaseModel, Field, create_model

from storage_service import get_user_supabase_client, BUCKET_NAME
from report_agent import report_agent
from excel_generator import generate_report_excel
from byok_encryption import byok_crypto

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# COLUMN CONFIGURATION
# ------------------------------------------------------------------------------

def get_report_columns(jwt_token: str) -> List[Dict[str, Any]]:
    """Fetch user-defined report columns."""
    supabase = get_user_supabase_client(jwt_token)
    result = supabase.table('report_columns').select('*').order('order').execute()
    return result.data

def update_report_columns(columns: List[Dict[str, Any]], jwt_token: str) -> List[Dict[str, Any]]:
    """Update report columns (replace all)."""
    try:
        supabase = get_user_supabase_client(jwt_token)
        
        # Get user safely
        user_resp = supabase.auth.get_user()
        if not user_resp.user:
            logger.error("Failed to get user from token")
            raise ValueError("Authentication failed: No user found for token")
            
        user_id = user_resp.user.id
        logger.info(f"Updating columns for user {user_id}")
        
        # 1. Delete existing
        supabase.table('report_columns').delete().eq('user_id', user_id).execute()
        
        # 2. Insert new
        new_cols = []
        for idx, col in enumerate(columns):
            new_cols.append({
                'user_id': user_id,
                'name': col['name'],
                'description': col.get('description'),
                'order': idx
            })
        
        if new_cols:
            result = supabase.table('report_columns').insert(new_cols).execute()
            logger.info(f"Successfully updated {len(new_cols)} columns")
            return result.data
        return []
    except Exception as e:
        logger.error(f"Error in update_report_columns: {e}")
        traceback.print_exc()
        raise e

# ------------------------------------------------------------------------------
# REPORT GENERATION
# ------------------------------------------------------------------------------

def fetch_events_in_range(start_date: str, end_date: str, jwt_token: str) -> List[Dict[str, Any]]:
    """Fetch events within a specific date range."""
    supabase = get_user_supabase_client(jwt_token)
    
    # Ensure end_date includes the full day if it's a timestamp
    # But since we use .lte on 'date' or 'timestamp', YYYY-MM-DD works differently.
    # To be safe with timestamps, we'll use OR logic on event_date and created_at
    
    # Fetch events where event_date is between start and end
    # OR where event_date is null and created_at is between start and end
    # Note: we add 23:59:59 to end_date for the created_at timestamp check
    end_ts = f"{end_date}T23:59:59"
    
    result = supabase.table('events') \
        .select('*') \
        .or_(f"and(event_date.gte.{start_date},event_date.lte.{end_date}),and(event_date.is.null,created_at.gte.{start_date},created_at.lte.{end_ts})") \
        .order('created_at', desc=True) \
        .execute()
        
    return result.data

def generate_report_preview(
    start_date: str,
    end_date: str, 
    columns: List[Dict[str, Any]], 
    jwt_token: str,
    llm_api_key: str,
    llm_provider: str = 'openai'
) -> Dict[str, Any]:
    """
    Generates report data.
    Returns:
      - valid_rows: List of fully resolved rows
      - unresolved_events: List of events needing manual doc selection
    """
    events = fetch_events_in_range(start_date, end_date, jwt_token)
    
    valid_rows = []
    unresolved_events = []
    skipped_events = []
    
    # Identify system columns to exclude from LLM
    SYSTEM_COLUMNS = ['S.No', 'Event Date', 'Event Name']
    llm_columns = [c for c in columns if c['name'] not in SYSTEM_COLUMNS]
    
    supabase = get_user_supabase_client(jwt_token)

    for idx, event in enumerate(events):
        event_id = event['id']
        event_name = event.get('name', 'Unknown Event')
        
        # 0. Skip if no documents
        doc_resp = supabase.table('templates').select('id', count='exact').eq('event_id', event_id).execute()
        if doc_resp.count == 0:
            skipped_events.append(event_name)
            continue

        event_date = event.get('event_date') or event.get('created_at')
        
        # Get schema from the 'event_schema' JSONB column
        schema = event.get('event_schema')
            
        # Run Agent
        inputs = {
            "columns": llm_columns,
            "event_schema": schema,
            "llm_provider": llm_provider,
            "api_key": llm_api_key
        }
        
        try:
            result = report_agent.invoke(inputs)
            inferred = result.get("inferred_data", {})
            unresolved_cols = result.get("unresolved_columns", [])
            
            row = inferred.copy()
            
            # Inject System Columns (S.No will be set later)
            for col in columns:
                if col['name'] == 'Event Name':
                    row['Event Name'] = event_name
                elif col['name'] == 'Event Date':
                    # Format date nicely
                    if event_date:
                        try:
                             # Supabase might return YYYY-MM-DD for date type
                             if isinstance(event_date, str) and len(event_date) == 10:
                                 row['Event Date'] = event_date
                             else:
                                 # Fallback for ISO strings or objects
                                 dt = datetime.fromisoformat(str(event_date).replace('Z', '+00:00'))
                                 row['Event Date'] = dt.strftime('%Y-%m-%d')
                        except:
                             row['Event Date'] = str(event_date)
                    else:
                         row['Event Date'] = ''

            # Ensure internal ID is present
            row["_event_id"] = event_id
            
            # Check if non-system columns are unresolved
            real_unresolved = [c for c in unresolved_cols if c in [col['name'] for col in llm_columns]]
            
            if real_unresolved:
                unresolved_events.append({
                    "event_id": event_id,
                    "event_name": event_name,
                    "unresolved_columns": real_unresolved,
                    "partial_data": row
                })
            else:
                valid_rows.append(row)
                
        except Exception as e:
            logger.error(f"Agent failed for event {event_id}: {e}")
            unresolved_events.append({
                "event_id": event_id,
                "event_name": event_name,
                "error": str(e),
                "unresolved_columns": [c['name'] for c in llm_columns] # All unresolved on crash
            })
    
    # Assign S.No to all valid rows after collection
    for idx, row in enumerate(valid_rows):
        row['S.No'] = idx + 1
            
    return {
        "valid_rows": valid_rows,
        "unresolved_events": unresolved_events,
        "skipped_events": skipped_events
    }


def get_event_documents(event_id: str, jwt_token: str) -> List[Dict[str, Any]]:
    """List documents for a specific event (for fallback UI)."""
    supabase = get_user_supabase_client(jwt_token)
    result = supabase.table('templates') \
        .select('id, name') \
        .eq('event_id', event_id) \
        .execute()
    return result.data

def resolve_event_with_docs(
    event_id: str, 
    doc_ids: List[str], 
    missing_columns: List[str],
    jwt_token: str
) -> Dict[str, Any]:
    """
    Fallback: Load selected docs and extract specific columns using LLM.
    """
    supabase = get_user_supabase_client(jwt_token)
    
    # 1. Fetch doc contents
    docs_content = []
    for doc_id in doc_ids:
        meta = supabase.table('templates').select('*').eq('id', doc_id).single().execute()
        if meta and meta.data.get('markdown_content'):
             docs_content.append(meta.data['markdown_content'])
             
    if not docs_content:
        return {col: None for col in missing_columns}

    # 2. Get user's API key
    user_resp = supabase.auth.get_user()
    if not user_resp.user:
        return {col: None for col in missing_columns}
    
    user_id = user_resp.user.id

    # Optional: pull user-defined column descriptions to better match intent (classification vs verbose text, etc.)
    col_desc_map: Dict[str, Optional[str]] = {}
    try:
        cols_resp = supabase.table('report_columns').select('name, description').eq('user_id', user_id).execute()
        for c in (cols_resp.data or []):
            name = c.get('name')
            if isinstance(name, str):
                col_desc_map[name] = c.get('description')
    except Exception as e:
        logger.warning(f"Could not load report column descriptions for structured extraction: {e}")
    
    # Fetch the user's active API key (BYOK) from the real table.
    # NOTE: Older code referenced a non-existent `byok_keys` table; the project uses `llm_api_keys`.
    key_resp = (
        supabase.table('llm_api_keys')
        .select('encrypted_key, provider, model')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .limit(1)
        .execute()
    )
    if not key_resp.data:
        return {col: None for col in missing_columns}

    key_data = key_resp.data[0]
    encrypted_key = key_data['encrypted_key']
    provider = key_data['provider']
    model = key_data.get('model')  # optional per schema

    # Decrypt API key
    api_key = byok_crypto.decrypt_api_key(encrypted_key)
    
    # 3. Use LLM to extract missing columns from documents
    from byok_providers import get_provider_adapter
    from langchain_core.messages import SystemMessage, HumanMessage
    
    try:
        adapter = get_provider_adapter(provider)
        # Use user's stored model when present; otherwise adapter defaults are used.
        if model:
            llm = adapter.create_llm(api_key=api_key, model=model, temperature=0)
        else:
            llm = adapter.create_llm(api_key=api_key, temperature=0)
        
        combined_content = "\n\n---\n\n".join(docs_content)

        # Prefer model-enforced structured output so keys match the configured column names.
        # We still include a plain prompt for extraction quality; the schema enforces the shape.
        # Include per-column descriptions to reflect user intent (e.g., classification labels vs verbose strings).
        fields_with_hints = []
        for col in missing_columns:
            desc = col_desc_map.get(col)
            if desc:
                fields_with_hints.append(f"- {col} (Hint: {desc})")
            else:
                fields_with_hints.append(f"- {col}")

        prompt = (
            "Extract the requested fields from the provided document content. "
            "If a value cannot be found, return null.\n\n"
            "Requested fields (with hints):\n"
            + "\n".join(fields_with_hints)
            + "\n\n"
            "Return short, presentation-ready values unless a hint explicitly asks for verbose text.\n\n"
            f"Document Content:\n{combined_content}"
        )

        # Pydantic field names must be valid identifiers; use internal names + aliases
        # to preserve the exact column names (including spaces/casing).
        field_defs: Dict[str, tuple[Any, Any]] = {}
        for idx, col in enumerate(missing_columns):
            hint = col_desc_map.get(col)
            internal_name = f"col_{idx}"
            field_defs[internal_name] = (
                Optional[str],
                Field(
                    default=None,
                    alias=col,
                    description=(
                        f"Value for '{col}'. "
                        + (f"Hint: {hint}. " if hint else "")
                        + "Return a short, presentation-ready value. Use null if missing."
                    ),
                ),
            )

        DynamicOut: type[BaseModel] = create_model(  # type: ignore[assignment]
            "DynamicDocExtraction",
            **field_defs,
        )

        try:
            structured_llm = llm.with_structured_output(DynamicOut)
            result_obj = structured_llm.invoke(prompt)
            data_by_alias = result_obj.model_dump(by_alias=True)
            return {col: data_by_alias.get(col) for col in missing_columns}
        except Exception as e:
            # Some provider wrappers/models may not support `with_structured_output`.
            logger.warning(f"Structured output failed, falling back to JSON parsing: {e}")

            messages = [HumanMessage(content=prompt)]
            response = llm.invoke(messages)
            content = (response.content or "").strip()

            import json

            start = content.find("{")
            end = content.rfind("}") + 1
            if start != -1 and end != -1:
                json_str = content[start:end]
                data = json.loads(json_str)
                return {col: data.get(col) for col in missing_columns}
    except Exception as e:
        logger.error(f"Error in resolve_event_with_docs: {e}")
    
    return {col: None for col in missing_columns}

def finalize_report_excel(
    columns: List[Any],  # Can be List[str] or List[Dict[str, Any]]
    rows: List[Dict[str, Any]], 
    time_range: str
) -> bytes:
    # Extract column names if we received column objects
    if columns and isinstance(columns[0], dict):
        column_names = [col['name'] for col in columns]
    else:
        column_names = columns
    
    return generate_report_excel(column_names, rows, time_range.title())
