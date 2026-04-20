import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client
import os

from app.core.supabase_runtime import (
    SupabaseRuntimeConfig,
    get_runtime_supabase_config,
    normalize_runtime_supabase_config,
)

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BUCKET_NAME = os.getenv("BUCKET_NAME", "documents")

base_supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    base_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_active_supabase_project_config() -> SupabaseRuntimeConfig:
    runtime_config = get_runtime_supabase_config()
    if runtime_config:
        return runtime_config

    if SUPABASE_URL and SUPABASE_KEY:
        return SupabaseRuntimeConfig(url=SUPABASE_URL, anon_key=SUPABASE_KEY)

    raise RuntimeError(
        "Supabase project not configured for this request. Provide X-Supabase-Url and X-Supabase-Anon-Key headers."
    )


def get_user_supabase_client(
    jwt_token: str,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
) -> Client:
    if supabase_url and supabase_key:
        project_config = normalize_runtime_supabase_config(supabase_url, supabase_key)
    else:
        project_config = get_active_supabase_project_config()

    supabase = create_client(
        project_config.url,
        project_config.anon_key,
        options=ClientOptions(
            persist_session=False,
            auto_refresh_token=False,
        ),
    )
    supabase.auth.set_session(jwt_token, refresh_token="")
    return supabase


def sanitize_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in ".-_" else "_" for c in name)


def get_events(jwt_token: Optional[str] = None) -> List[Dict[str, Any]]:
    supabase = get_user_supabase_client(jwt_token)
    result = supabase.table("events").select("*").order("created_at", desc=True).execute()
    return [
        {
            "id": event["id"],
            "name": event["name"],
            "description": event["description"],
            "createdAt": event["created_at"],
            "eventDate": event.get("event_date"),
        }
        for event in result.data
    ]


def save_event(event: Dict[str, Any], jwt_token: Optional[str] = None) -> None:
    supabase = get_user_supabase_client(jwt_token)
    user = supabase.auth.get_user()
    user_id = user.user.id if user.user else None
    event_data = {
        "id": event["id"],
        "name": event["name"],
        "description": event["description"],
        "created_at": event["createdAt"],
        "event_date": event.get("eventDate"),
    }
    if user_id:
        event_data["user_id"] = user_id
    supabase.table("events").upsert(event_data).execute()


def delete_event(event_id: str, jwt_token: Optional[str] = None) -> None:
    supabase = get_user_supabase_client(jwt_token)
    supabase.table("templates").delete().eq("event_id", event_id).execute()
    supabase.table("events").delete().eq("id", event_id).execute()


def get_docs(event_id: Optional[str] = None, jwt_token: Optional[str] = None) -> List[Dict[str, Any]]:
    supabase = get_user_supabase_client(jwt_token)
    query = supabase.table("templates").select("*")
    if event_id:
        query = query.eq("event_id", event_id)
    result = query.execute()
    return [
        {
            "id": doc["id"],
            "eventId": doc["event_id"],
            "name": doc["name"],
            "originalFilePath": doc["original_file_path"],
            "templateFilePath": doc["template_file_path"],
            "uploadDate": doc["upload_date"],
            "markdownContent": doc.get("markdown_content", ""),
            "tableData": doc.get("table_data", []),
            "drive_file_id": doc.get("drive_file_id"),
            "preview_status": doc.get("preview_status"),
        }
        for doc in (result.data or [])
    ]


def extract_and_store_markdown_from_path(
    doc_id: str,
    file_path: str,
    jwt_token: str,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
):
    try:
        supabase = get_user_supabase_client(
            jwt_token,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
        )
        file_bytes = supabase.storage.from_(BUCKET_NAME).download(file_path)
        from extract import docx_bytes_to_markdown_for_preview
        from extract_tables import extract_tables_from_docx_bytes

        markdown_content = docx_bytes_to_markdown_for_preview(file_bytes)
        table_data = extract_tables_from_docx_bytes(file_bytes)
        supabase.table("templates").update(
            {
                "markdown_content": markdown_content,
                "table_data": table_data,
            }
        ).eq("id", doc_id).execute()
    except Exception as exc:
        print(f"Error extracting content for doc {doc_id}: {exc}")


def upload_doc(event_id: str, name: str, file_bytes: bytes, jwt_token: Optional[str] = None) -> str:
    supabase = get_user_supabase_client(jwt_token)
    doc_id = str(uuid.uuid4())
    safe_filename = sanitize_filename(name)
    user = supabase.auth.get_user()
    user_id = user.user.id if user.user else None
    file_path = f"{user_id}/{event_id}/{doc_id}/{safe_filename}"
    supabase.storage.from_(BUCKET_NAME).upload(
        path=file_path,
        file=file_bytes,
        file_options={
            "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        },
    )
    template_data = {
        "id": doc_id,
        "event_id": event_id,
        "name": name,
        "original_file_path": file_path,
        "template_file_path": file_path,
        "upload_date": datetime.now().isoformat(),
        "markdown_content": None,
        "preview_status": "pending",
    }
    if user_id:
        template_data["user_id"] = user_id
    supabase.table("templates").insert(template_data).execute()
    if jwt_token:
        project_config = get_active_supabase_project_config()
        thread = threading.Thread(
            target=extract_and_store_markdown_from_path,
            args=(doc_id, file_path, jwt_token, project_config.url, project_config.anon_key),
        )
        thread.daemon = True
        thread.start()
    return doc_id


def download_doc(
    doc_id: str,
    jwt_token: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
) -> bytes:
    supabase = get_user_supabase_client(jwt_token, supabase_url=supabase_url, supabase_key=supabase_key)
    result = supabase.table("templates").select("original_file_path").eq("id", doc_id).single().execute()
    file_path = result.data["original_file_path"]
    return supabase.storage.from_(BUCKET_NAME).download(file_path)


def update_doc_template(
    doc_id: str,
    variables: List[Dict[str, Any]],
    template_bytes: bytes,
    jwt_token: Optional[str] = None,
) -> None:
    supabase = get_user_supabase_client(jwt_token)
    result = supabase.table("templates").select("*").eq("id", doc_id).single().execute()
    doc = result.data
    safe_filename = sanitize_filename(doc["name"])
    template_path = (
        f"{doc['original_file_path'].split('/')[0]}/{doc['event_id']}/{doc_id}/{safe_filename}_template"
    )
    supabase.storage.from_(BUCKET_NAME).upload(
        path=template_path,
        file=template_bytes,
        file_options={
            "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        },
    )
    supabase.table("templates").update({"template_file_path": template_path}).eq("id", doc_id).execute()


def delete_doc(doc_id: str, jwt_token: Optional[str] = None) -> None:
    supabase = get_user_supabase_client(jwt_token)
    result = (
        supabase.table("templates")
        .select("original_file_path, template_file_path")
        .eq("id", doc_id)
        .single()
        .execute()
    )
    doc = result.data
    paths_to_delete = [doc["original_file_path"]]
    if doc["template_file_path"] != doc["original_file_path"]:
        paths_to_delete.append(doc["template_file_path"])
    supabase.storage.from_(BUCKET_NAME).remove(paths_to_delete)
    supabase.table("templates").delete().eq("id", doc_id).execute()


def delete_all_event_docs(event_id: str, jwt_token: str) -> Dict[str, int]:
    supabase = get_user_supabase_client(jwt_token)
    result = (
        supabase.table("templates")
        .select("original_file_path, template_file_path")
        .eq("event_id", event_id)
        .execute()
    )
    docs = result.data or []
    if not docs:
        return {"deleted_count": 0}
    paths_to_delete = set()
    for doc in docs:
        if doc.get("original_file_path"):
            paths_to_delete.add(doc["original_file_path"])
        if doc.get("template_file_path"):
            paths_to_delete.add(doc["template_file_path"])
    if paths_to_delete:
        supabase.storage.from_(BUCKET_NAME).remove(list(paths_to_delete))
    db_result = supabase.table("templates").delete().eq("event_id", event_id).execute()
    return {"deleted_count": len(db_result.data or [])}

