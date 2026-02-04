import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import traceback
from supabase import Client

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
            
            # Inject System Columns
            for col in columns:
                if col['name'] == 'S.No':
                    row['S.No'] = len(valid_rows) + 1 # Sync with final row count
                elif col['name'] == 'Event Name':
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
    Fallback: Load selected docs and extract specific columns.
    Uses a simplified extraction (mocked for now, or reusing schema agent logic).
    """
    supabase = get_user_supabase_client(jwt_token)
    
    # 1. Fetch doc contents
    docs_content = []
    for doc_id in doc_ids:
        # Fetch metadata to get path
        meta = supabase.table('templates').select('*').eq('id', doc_id).single().execute()
        if meta and meta.data.get('markdown_content'):
             docs_content.append(meta.data['markdown_content'])
             
    if not docs_content:
        return {col: None for col in missing_columns}

    # 2. Use a simple prompt to extract specific fields from concatenated markdown
    # Note: In a full impl, we'd inject the LLM here. For now, assume we return placeholders
    # or implement a mini-agent here.
    
    # TODO: Connect to SchemaAgent or run Ad-hoc extraction
    # For this MVP step, let's return a placeholder to prove the flow.
    # In "Step 4: Document-Based Resolution", it says "Reuse the same extraction logic".
    
    return {col: f"[Extracted from {len(doc_ids)} docs]" for col in missing_columns}

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
