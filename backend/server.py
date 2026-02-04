import json,uuid
from datetime import datetime
import os

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, BackgroundTasks
from typing import List, Dict, Any, Optional
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from extract import docx_bytes_to_markdown_for_preview
from replace import replace_text_in_document_bytes
from storage_service import (
    get_events, save_event, delete_event,
    get_docs, delete_all_event_docs, download_doc, update_doc_template, delete_doc,
    get_user_supabase_client, sanitize_filename, BUCKET_NAME, extract_and_store_markdown_from_path
)
from schemaModels import SchemaDiscoveryRequest
from schemaAgent import  schema_discovery_workflow, INITIAL_STATS
from byok_endpoints import byok_router
from byok_service import key_broker
from report_service import (
    get_report_columns, update_report_columns, 
    generate_report_preview, resolve_event_with_docs, finalize_report_excel
)

# Set up the FastAPI app and add routes
app = FastAPI(
    title="Document Processing API",
    version="1.0",
    description="API server for document processing and variable suggestions.",
    docs_url="/swagger"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include BYOK router
app.include_router(byok_router)

# JWT Token extraction
def get_jwt_token(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]  # Remove "Bearer " prefix
    return None

@app.post("/extract-markdown")
async def extract_markdown(file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    if not file.filename or not file.filename.endswith('.docx'):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    
    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        markdown = docx_bytes_to_markdown_for_preview(file_bytes)
        return {"markdown": markdown}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/replace-text/{doc_id}")
async def replace_text(
    doc_id: str,
    replacements_json: str = Form(...),
    table_edits_json: str = Form(default="[]"),
    token: Optional[str] = Depends(get_jwt_token)
):
    try:
        replacements = json.loads(replacements_json)
        table_edits = json.loads(table_edits_json)
        
        # Get document info for filename
        supabase = get_user_supabase_client(token)
        doc_result = supabase.table('templates').select('name').eq('id', doc_id).execute()
        filename = doc_result.data[0]['name'] if doc_result.data else None
        
        # Debug logging
        print(f"\n=== REPLACE-TEXT API DEBUG ===")
        print(f"Doc ID: {doc_id}")
        print(f"Filename: {filename}")
        print(f"Replacements received: {replacements}")
        print(f"Table edits received: {table_edits}")
        print(f"Number of replacements: {len(replacements)}")
        for i, replacement in enumerate(replacements):
            print(f"  [{i}] Original: '{replacement[0]}' -> New: '{replacement[1]}'")
        print(f"==============================\n")
        
        file_bytes = download_doc(doc_id, token)

        # Call the updated bytes function with table edits and filename
        output_file, count = replace_text_in_document_bytes(
            file_bytes, 
            replacements, 
            table_edits, 
            filename=filename
        )
        
        print(f"Total replacements made: {count}")
        
        # Return the file as a stream
        return StreamingResponse(
            output_file,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="processed_document.docx"',
                "X-Total-Replacements": str(count) # Custom header to send the count
            }
        )
    except Exception as e:
        print(f"Error in replace_text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Pydantic models
class Event(BaseModel):
    id: str
    name: str
    description: str
    createdAt: str
    eventDate: Optional[str] = None

class Variable(BaseModel):
    variableName: str
    originalText: str

# Storage endpoints
@app.get("/events")
async def list_events(token: Optional[str] = Depends(get_jwt_token)):
    try:
        events = get_events(token)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/events")
async def create_event(event: Event, token: Optional[str] = Depends(get_jwt_token)):
    try:
        save_event(event.model_dump(), token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/events/{event_id}")
async def update_event(event_id: str, data: dict, token: Optional[str] = Depends(get_jwt_token)):
    try:
        supabase = get_user_supabase_client(token)
        supabase.table('events').update(data).eq('id', event_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/events/{event_id}")
async def remove_event(event_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        delete_event(event_id, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs")
async def list_docs(event_id: str | None = None, token: Optional[str] = Depends(get_jwt_token)):
    try:
        docs = get_docs(event_id, token)
        return {"docs": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import threading # Ensure this is imported at the top

@app.post("/docs/upload-url")
async def get_upload_url(name: str, event_id: str, token: Optional[str] = Depends(get_jwt_token)):
    """Step 1: Check for duplicates, then generate a signed URL"""
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        # 1. CHECK FOR DUPLICATES: See if this file name already exists for this event
        existing = supabase.table('templates') \
            .select('id, original_file_path') \
            .eq('event_id', event_id) \
            .eq('name', name) \
            .execute()

        if existing.data:
            # Graceful Exit: Return info about the existing file
            return {
                "status": "exists",
                "doc_id": existing.data[0]['id'],
                "file_path": existing.data[0]['original_file_path'],
                "message": "File already exists in this event"
            }

        # 2. PROCEED WITH NEW UPLOAD: Generate new ID and URL
        doc_id = str(uuid.uuid4())
        safe_filename = sanitize_filename(name)
        # Note: Path includes doc_id to ensure storage uniqueness if needed, 
        # but the check above handles logical duplicates.
        file_path = f"{user_id}/{event_id}/{doc_id}/{safe_filename}"
        
        response = supabase.storage.from_(BUCKET_NAME).create_signed_upload_url(file_path)
        
        return {
            "status": "new",
            "upload_url": response['signed_url'],
            "file_path": file_path,
            "doc_id": doc_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/docs/confirm")
async def confirm_upload(data: dict, background_tasks: BackgroundTasks, token: Optional[str] = Depends(get_jwt_token)):
    try:
        supabase = get_user_supabase_client(token)
        doc_id = data.get('id')
        event_id = data.get('eventId')
        file_path = data.get('file_path')

        if not event_id:
            raise HTTPException(status_code=400, detail="event_id is required")

        # 1. Build the update payload
        update_data = {
            'id': doc_id,
            'event_id': event_id,
            'name': data.get('name')
        }

        # 2. Only add these fields if a path is provided (indicating a successful storage upload)
        if file_path:
            update_data.update({
                'original_file_path': file_path,
                'template_file_path': file_path,
                'upload_date': datetime.now().isoformat(),
                'markdown_content': None,
                'table_data': []
            })

        try:
            user_resp = supabase.auth.get_user(token)
            update_data['user_id'] = user_resp.user.id
        except:
            pass

        # 3. UPSERT: Handles insertion. 
        supabase.table('templates').upsert(update_data, on_conflict='id').execute()
        
        # 4. Trigger extraction ONLY for new paths
        if file_path:
            print(f"Starting background extraction for doc {doc_id}")
            background_tasks.add_task(
                extract_and_store_markdown_from_path, 
                doc_id, file_path, token
            )
        
        return {"status": "success", "docId": doc_id}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs/{doc_id}")
async def download_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        file_bytes = download_doc(doc_id, token)
        return Response(
            content=file_bytes,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={'Content-Disposition': 'attachment; filename="document.docx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/docs/{doc_id}/template")
async def update_template(doc_id: str, variables: str = Form(...), file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    try:
        import json
        variables_list = json.loads(variables)
        file_bytes = await file.read()
        update_doc_template(doc_id, variables_list, file_bytes, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/docs/{doc_id}")
async def remove_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        delete_doc(doc_id, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/events/{event_id}/docs")
async def delete_all_docs(event_id: str, token: str = Depends(get_jwt_token)):
    try:
        result = delete_all_event_docs(event_id, token)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/docs/{doc_id}/extract")
async def manual_extract(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    """Manually trigger markdown and table extraction for a document"""
    try:
        supabase = get_user_supabase_client(token)
        
        # Get document info
        result = supabase.table('templates').select('original_file_path').eq('id', doc_id).single().execute()
        file_path = result.data['original_file_path']
        
        # Download and extract
        file_bytes = supabase.storage.from_(BUCKET_NAME).download(file_path)
        
        from extract import docx_bytes_to_markdown_for_preview
        from extract_tables import extract_tables_from_docx_bytes
        
        markdown_content = docx_bytes_to_markdown_for_preview(file_bytes)
        table_data = extract_tables_from_docx_bytes(file_bytes)
        
        # Update database
        supabase.table('templates').update({
            'markdown_content': markdown_content,
            'table_data': table_data
        }).eq('id', doc_id).execute()
        
        return {
            "success": True,
            "markdown_length": len(markdown_content),
            "tables_found": len(table_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/discover-schema")
async def discover_schema(req: SchemaDiscoveryRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not req.documents:
        raise HTTPException(status_code=400, detail="No documents provided")
    
    # Get user ID for BYOK
    user_id = None
    if token:
        try:
            supabase = get_user_supabase_client(token)
            user = supabase.auth.get_user()
            user_id = user.user.id
        except Exception:
            pass
    
    # Get LLM instance using BYOK with strict enforcement
    try:
        llm_instance, key_metadata = key_broker.get_llm_for_user(
            user_id=user_id or "anonymous",
            provider="groq",  # Default to Groq
            model="llama-3.3-70b-versatile",
            jwt_token=token,
            strict_byok=True,  # Enforce BYOK
            temperature=0
        )
    except ValueError as e:
        error_msg = str(e)
        if "BYOK_REQUIRED" in error_msg:
            raise HTTPException(
                status_code=403, 
                detail={
                    "error": "BYOK_REQUIRED",
                    "message": "Please add your API key in Settings to use AI features.",
                    "action": "setup_keys"
                }
            )
        elif "BYOK_SETUP_REQUIRED" in error_msg:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "BYOK_SETUP_REQUIRED", 
                    "message": "No API keys available. Please add your API key in Settings.",
                    "action": "setup_keys"
                }
            )
        else:
            raise HTTPException(status_code=500, detail=f"Failed to initialize LLM: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize LLM: {str(e)}")

    doc_tuples = [(doc.filename, doc.markdown) for doc in req.documents]
    doc_paths = [doc.docx_path for doc in req.documents if doc.docx_path]

    # Extract table data from documents
    tables_data = []
    for doc in req.documents:
        if doc.docx_path and os.path.exists(doc.docx_path):
            try:
                with open(doc.docx_path, 'rb') as f:
                    file_bytes = f.read()
                from extract_tables import extract_tables_from_docx_bytes
                doc_tables = extract_tables_from_docx_bytes(file_bytes)
                if doc_tables:
                    tables_data.append({
                        "filename": doc.filename,
                        "tables": doc_tables,
                    })
            except Exception as e:
                print(f"Error extracting tables from {doc.filename}: {e}")

    # Pass LLM instance and user context to workflow
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

    # Add key source info to response
    response: Dict[str, Any] = {
        "schema": result.get("final_schema", {}),
        "tables": tables_data,
        "stats": stats,
        "key_info": key_metadata,
        "message": "✅ Cache hit!" if stats.get("cache_hit") else
        f"✅ Generated from {stats.get('docs_processed', 0)} docs",
    }
    
    # Add warning if using fallback keys
    if key_metadata.get('fallback_used'):
        response["warning"] = "Using system fallback API keys. Add your own keys in Settings for better control."

    llm_summary = stats.get("llm", {}).get("summary", {})
    if llm_summary.get("llm_calls", 0) > 0:
        response["estimated_cost"] = {
            "tokens": llm_summary.get("total_tokens", 0),
            "input_cost_usd": 0.0,   # plug in real pricing if needed
            "output_cost_usd": 0.0,
            "total_cost_usd": 0.0,
        }

    return response

    
# ------------------------------------------------------------------------------
# REPORT ENDPOINTS
# ------------------------------------------------------------------------------

@app.get("/report/columns")
async def get_columns(token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return {"columns": get_report_columns(token)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ColumnsUpdate(BaseModel):
    columns: List[Dict[str, Any]]

@app.post("/report/columns")
async def update_columns(data: ColumnsUpdate, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return {"columns": update_report_columns(data.columns, token)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ReportGenerateRequest(BaseModel):
    start_date: str
    end_date: str
    columns: List[Dict[str, Any]] # name and description

@app.post("/report/generate")
async def generate_report(req: ReportGenerateRequest, token: Optional[str] = Depends(get_jwt_token)):
    try:
        # Get LLM API Key via BYOK
        # We need the KEY string itself for the agent, not the LangChain object
        # So we use the broker to get metadata, but for now we might need to expose the raw key safely
        # OR better: Refactor report_service to use the broker internally.
        # For this MVP, let's extract the key if possible or modify key_broker to return it.
        
        # HACK: For MVP, we'll get the key from the request header if provided, 
        # or fetch from DB via our encryption service if we can.
        # But `report_service.py` calls `report_agent` which needs an API key. 
        # Let's use `key_broker` here to get the key.
        
        supabase = get_user_supabase_client(token)
        user_id = supabase.auth.get_user().user.id
        
        # We need the RAW key for the agent node (or pass the LLM object).
        # Our `ReportAgent` graph creates the LLM inside the node using `api_key`.
        # This means we need to pass the decrypted key string.
        
        # We can implement a helper in `byok_service` to get the key string safely.
        # For now, let's modify `key_broker` or add a method there.
        # Checking `byok_service.py` (assumed) or implementing logic here:
        
        # 1. Try to fetch requested provider (default openai)
        key_record = supabase.table('llm_api_keys').select('*').eq('user_id', user_id).eq('provider', 'openai').execute()
        
        api_key = None
        provider = 'openai'
        
        if key_record.data and len(key_record.data) > 0:
            from byok_encryption import byok_crypto
            api_key = byok_crypto.decrypt_api_key(key_record.data[0]['encrypted_key'])
            provider = key_record.data[0]['provider']
        else:
            # 2. Fallback: Get any available key (e.g. groq, gemini) if openai is missing
            all_keys = supabase.table('llm_api_keys').select('*').eq('user_id', user_id).execute()
            if all_keys.data and len(all_keys.data) > 0:
                from byok_encryption import byok_crypto
                # Pick the first one
                api_key = byok_crypto.decrypt_api_key(all_keys.data[0]['encrypted_key'])
                provider = all_keys.data[0]['provider']
                print(f"DEBUG: Using fallback provider '{provider}' for report generation")
            else:
                 raise HTTPException(
                     status_code=400, 
                     detail="No LLM API Key found. Please set an API key in Settings -> BYOK Settings."
                 )
             
        if not api_key:
             raise HTTPException(status_code=403, detail="Failed to retrieve API Key.")

        result = generate_report_preview(
            req.start_date, 
            req.end_date,
            req.columns, 
            token, 
            llm_api_key=api_key,
            llm_provider=provider
        )
        return result
    except Exception as e:
        print(f"Report generation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ReportResolveRequest(BaseModel):
    event_id: str
    doc_ids: List[str]
    missing_columns: List[str]

@app.post("/report/resolve")
async def resolve_report(req: ReportResolveRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        resolved_data = resolve_event_with_docs(
            req.event_id, 
            req.doc_ids, 
            req.missing_columns, 
            token
        )
        return {"resolved_data": resolved_data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ReportDownloadRequest(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    start_date: str
    end_date: str

@app.post("/report/download")
async def download_report(req: ReportDownloadRequest):
    try:
        # Finalize report can use the date range instead of time_range
        time_desc = f"{req.start_date}_to_{req.end_date}"
        excel_bytes = finalize_report_excel(req.columns, req.rows, time_desc)
        filename = f"Report_{time_desc}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return Response(
            content=excel_bytes,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
