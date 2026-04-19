import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import get_user_supabase_client
from byok_service import key_broker
from extract_tables import extract_tables_from_docx_bytes
from schemaAgent import INITIAL_STATS, schema_discovery_workflow
from schemaModels import SchemaDiscoveryRequest

schema_router = APIRouter(tags=["Schema Discovery"])


@schema_router.post("/discover-schema")
async def discover_schema(req: SchemaDiscoveryRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not req.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    user_id = None
    if token:
        try:
            supabase = get_user_supabase_client(token)
            user_id = supabase.auth.get_user().user.id
        except Exception:
            user_id = None

    try:
        llm_instance, key_metadata = key_broker.get_llm_for_user(
            user_id=user_id or "anonymous",
            provider=None,
            model=None,
            jwt_token=token,
            strict_byok=True,
            temperature=0,
        )
    except Exception as exc:
        error_msg = str(exc)
        if "BYOK_REQUIRED" in error_msg:
            raise HTTPException(
                status_code=403,
                detail={"error": "BYOK_REQUIRED", "message": "Please add your API key in Settings to use AI features.", "action": "setup_keys"},
            ) from exc
        raise HTTPException(
            status_code=403,
            detail={"error": "BYOK_SETUP_REQUIRED", "message": "No API keys available. Please add your API key in Settings.", "action": "setup_keys"},
        ) from exc

    doc_tuples = [(doc.filename, doc.markdown) for doc in req.documents]
    doc_paths = [doc.docx_path for doc in req.documents if doc.docx_path]

    tables_data = []
    for doc in req.documents:
        if doc.docx_path and os.path.exists(doc.docx_path):
            try:
                with open(doc.docx_path, "rb") as file_obj:
                    file_bytes = file_obj.read()
                doc_tables = extract_tables_from_docx_bytes(file_bytes)
                if doc_tables:
                    tables_data.append({"filename": doc.filename, "tables": doc_tables})
            except Exception as exc:
                print(f"Error extracting tables from {doc.filename}: {exc}")

    result = schema_discovery_workflow.invoke(
        {
            "documents": doc_tuples,
            "doc_paths": doc_paths,
            "stats": INITIAL_STATS.copy(),
            "user_instructions": req.user_instructions,
            "user_id": user_id,
            "jwt_token": token,
            "llm_instance": llm_instance,
        }
    )

    stats = result.get("stats", INITIAL_STATS)
    response: Dict[str, Any] = {
        "schema": result.get("final_schema", {}),
        "tables": tables_data,
        "stats": stats,
        "key_info": key_metadata,
        "message": "✅ Cache hit!" if stats.get("cache_hit") else f"✅ Generated from {stats.get('docs_processed', 0)} docs",
    }
    llm_summary = stats.get("llm", {}).get("summary", {})
    if llm_summary.get("llm_calls", 0) > 0:
        response["estimated_cost"] = {
            "tokens": llm_summary.get("total_tokens", 0),
            "input_cost_usd": 0.0,
            "output_cost_usd": 0.0,
            "total_cost_usd": 0.0,
        }
    return response

