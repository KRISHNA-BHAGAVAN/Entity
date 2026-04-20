import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import (
    BUCKET_NAME,
    delete_all_event_docs,
    delete_doc,
    delete_event,
    download_doc,
    extract_and_store_markdown_from_path,
    get_docs,
    get_events,
    get_active_supabase_project_config,
    get_user_supabase_client,
    sanitize_filename,
    save_event,
    update_doc_template,
)
from byod_service import byod_service
from drive_upload_worker import async_drive_upload_worker
from extract import docx_bytes_to_markdown_for_preview
from extract_tables import extract_tables_from_docx_bytes
from replace import replace_text_in_document_bytes

documents_router = APIRouter(tags=["Documents"])


class Event(BaseModel):
    id: str
    name: str
    description: str
    createdAt: str
    eventDate: Optional[str] = None


@documents_router.post("/extract-markdown")
async def extract_markdown(file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    return {"markdown": docx_bytes_to_markdown_for_preview(file_bytes)}


@documents_router.post("/replace-text/{doc_id}")
async def replace_text(
    doc_id: str,
    replacements_json: str = Form(...),
    table_edits_json: str = Form(default="[]"),
    token: Optional[str] = Depends(get_jwt_token),
):
    replacements = json.loads(replacements_json)
    table_edits = json.loads(table_edits_json)
    supabase = get_user_supabase_client(token)
    doc_result = supabase.table("templates").select("name").eq("id", doc_id).execute()
    filename = doc_result.data[0]["name"] if doc_result.data else None
    file_bytes = download_doc(doc_id, token)
    output_file, count = replace_text_in_document_bytes(
        file_bytes,
        replacements,
        table_edits,
        filename=filename,
    )
    return StreamingResponse(
        output_file,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": 'attachment; filename="processed_document.docx"',
            "X-Total-Replacements": str(count),
        },
    )


@documents_router.get("/events")
async def list_events(token: Optional[str] = Depends(get_jwt_token)):
    return {"events": get_events(token)}


@documents_router.post("/events")
async def create_event(event: Event, token: Optional[str] = Depends(get_jwt_token)):
    save_event(event.model_dump(), token)
    return {"success": True}


@documents_router.put("/events/{event_id}")
async def update_event(event_id: str, data: dict, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    supabase.table("events").update(data).eq("id", event_id).execute()
    return {"success": True}


@documents_router.delete("/events/{event_id}")
async def remove_event(event_id: str, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    user_id = supabase.auth.get_user().user.id
    try:
        res = supabase.table("templates").select("drive_file_id").eq("event_id", event_id).execute()
        for doc in res.data or []:
            if doc.get("drive_file_id"):
                byod_service.delete_from_drive(supabase, user_id, doc["drive_file_id"])
    except Exception as exc:
        print(f"Error handling drive deletion on event deletion: {exc}")
    delete_event(event_id, token)
    return {"success": True}


@documents_router.get("/docs")
async def list_docs(event_id: str | None = None, token: Optional[str] = Depends(get_jwt_token)):
    return {"docs": get_docs(event_id, token)}


@documents_router.post("/docs/upload-url")
async def get_upload_url(name: str, event_id: str, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    existing = (
        supabase.table("templates")
        .select("id, original_file_path")
        .eq("event_id", event_id)
        .eq("name", name)
        .execute()
    )
    if existing.data:
        return {
            "status": "exists",
            "doc_id": existing.data[0]["id"],
            "file_path": existing.data[0]["original_file_path"],
            "message": "File already exists in this event",
        }
    doc_id = str(uuid.uuid4())
    safe_filename = sanitize_filename(name)
    file_path = f"{user_id}/{event_id}/{doc_id}/{safe_filename}"
    response = supabase.storage.from_(BUCKET_NAME).create_signed_upload_url(file_path)
    return {"status": "new", "upload_url": response["signed_url"], "file_path": file_path, "doc_id": doc_id}


@documents_router.post("/docs/confirm")
async def confirm_upload(data: dict, background_tasks: BackgroundTasks, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    doc_id = data.get("id")
    event_id = data.get("eventId")
    file_path = data.get("file_path")
    if not event_id:
        raise HTTPException(status_code=400, detail="event_id is required")

    update_data = {"id": doc_id, "event_id": event_id, "name": data.get("name")}
    if file_path:
        update_data.update(
            {
                "original_file_path": file_path,
                "template_file_path": file_path,
                "upload_date": datetime.now().isoformat(),
                "markdown_content": None,
                "table_data": [],
                "preview_status": "pending",
                "drive_file_id": None,
            }
        )
    try:
        user_resp = supabase.auth.get_user(token)
        update_data["user_id"] = user_resp.user.id
    except Exception:
        pass
    supabase.table("templates").upsert(update_data, on_conflict="id").execute()

    if file_path:
        project_config = get_active_supabase_project_config()
        background_tasks.add_task(
            extract_and_store_markdown_from_path,
            doc_id,
            file_path,
            token,
            project_config.url,
            project_config.anon_key,
        )
        try:
            user_id = supabase.auth.get_user().user.id
            drive_check = supabase.table("drive_connections").select("id").eq("user_id", user_id).execute()
            if drive_check.data:
                background_tasks.add_task(
                    async_drive_upload_worker,
                    doc_id,
                    token,
                    data.get("name"),
                    project_config.url,
                    project_config.anon_key,
                )
            else:
                supabase.table("templates").update(
                    {"preview_status": "not_configured", "drive_file_id": None}
                ).eq("id", doc_id).execute()
        except Exception as exc:
            print(f"Error checking Drive configuration: {exc}")
    return {"status": "success", "docId": doc_id}


@documents_router.get("/docs/{doc_id}")
async def download_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    file_bytes = download_doc(doc_id, token)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="document.docx"'},
    )


@documents_router.put("/docs/{doc_id}/template")
async def update_template(doc_id: str, variables: str = Form(...), file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    update_doc_template(doc_id, json.loads(variables), await file.read(), token)
    return {"success": True}


@documents_router.delete("/docs/{doc_id}")
async def remove_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    res = supabase.table("templates").select("drive_file_id").eq("id", doc_id).execute()
    if res.data and res.data[0].get("drive_file_id"):
        user_id = supabase.auth.get_user().user.id
        byod_service.delete_from_drive(supabase, user_id, res.data[0]["drive_file_id"])
    delete_doc(doc_id, token)
    return {"success": True}


@documents_router.delete("/events/{event_id}/docs")
async def delete_all_docs(event_id: str, token: str = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    user_id = supabase.auth.get_user().user.id
    try:
        res = supabase.table("templates").select("drive_file_id").eq("event_id", event_id).execute()
        for doc in res.data or []:
            if doc.get("drive_file_id"):
                byod_service.delete_from_drive(supabase, user_id, doc["drive_file_id"])
    except Exception as exc:
        print(f"Error handling drive deletion on all docs deletion: {exc}")
    result = delete_all_event_docs(event_id, token)
    return {"success": True, **result}


@documents_router.post("/docs/{doc_id}/extract")
async def manual_extract(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    supabase = get_user_supabase_client(token)
    result = supabase.table("templates").select("original_file_path").eq("id", doc_id).single().execute()
    file_path = result.data["original_file_path"]
    file_bytes = supabase.storage.from_(BUCKET_NAME).download(file_path)
    markdown_content = docx_bytes_to_markdown_for_preview(file_bytes)
    table_data = extract_tables_from_docx_bytes(file_bytes)
    supabase.table("templates").update(
        {"markdown_content": markdown_content, "table_data": table_data}
    ).eq("id", doc_id).execute()
    return {"success": True, "markdown_length": len(markdown_content), "tables_found": len(table_data)}

