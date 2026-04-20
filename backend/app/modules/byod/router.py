import threading
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from google.oauth2.credentials import Credentials

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import get_active_supabase_project_config, get_user_supabase_client
from app.modules.byod.service import SCOPES, byod_service
from byok_encryption import byok_crypto

byod_router = APIRouter(prefix="/api/byod", tags=["BYOD"])


def get_client_credentials():
    import os

    client_id = os.getenv("GOOGLE_CLIENT_ID", "DUMMY_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "DUMMY_CLIENT_SECRET")
    return client_id, client_secret


@byod_router.post("/auth/url")
async def get_auth_url(data: dict = Body(...), token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    redirect_uri = data.get("redirect_uri")
    client_id, _ = get_client_credentials()
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"url": auth_url}


@byod_router.post("/auth/callback")
async def auth_callback(data: dict = Body(...), token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    code = data.get("code")
    redirect_uri = data.get("redirect_uri")
    client_id, client_secret = get_client_credentials()
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    token_data = response.json()
    if response.status_code != 200 or "error" in token_data:
        raise HTTPException(status_code=400, detail=f"Google Auth Error: {token_data.get('error_description', token_data)}")

    expiry = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
    credentials = Credentials(
        token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
        expiry=expiry,
    )

    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    connection_data = {
        "access_token": byok_crypto.encrypt_api_key(credentials.token),
        "token_expiry": credentials.expiry.isoformat() + "Z" if credentials.expiry else None,
    }
    if credentials.refresh_token:
        connection_data["refresh_token"] = byok_crypto.encrypt_api_key(credentials.refresh_token)

    existing = supabase.table("drive_connections").select("id").eq("user_id", user_id).execute()
    if existing.data:
        connection_data["updated_at"] = datetime.utcnow().isoformat()
        supabase.table("drive_connections").update(connection_data).eq("user_id", user_id).execute()
    else:
        connection_data["user_id"] = user_id
        supabase.table("drive_connections").insert(connection_data).execute()

    return {"success": True}


@byod_router.post("/folder")
async def set_folder(data: dict = Body(...), token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    folder_id = byod_service.extract_folder_id(data.get("url"))
    migrate_files = data.get("migrate_files", False)
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    drive_connection = supabase.table("drive_connections").select("root_folder_id").eq("user_id", user_id).execute()
    if not drive_connection.data:
        raise HTTPException(status_code=400, detail="Google Drive not connected. Please connect your Google Drive account first.")

    old_folder_id = drive_connection.data[0].get("root_folder_id")
    supabase.table("drive_connections").update(
        {"root_folder_id": folder_id, "updated_at": datetime.utcnow().isoformat()}
    ).eq("user_id", user_id).execute()

    migration_result = {"migrated": 0, "failed": 0}
    if migrate_files and old_folder_id and old_folder_id != folder_id:
        docs_result = supabase.table("templates").select("id, drive_file_id, name").eq("user_id", user_id).execute()
        for doc in docs_result.data or []:
            if doc.get("drive_file_id"):
                try:
                    byod_service.move_file_to_folder(supabase, user_id, doc["drive_file_id"], folder_id)
                    migration_result["migrated"] += 1
                except Exception:
                    migration_result["failed"] += 1
    else:
        docs_result = supabase.table("templates").select("id, name, original_file_path").eq("user_id", user_id).execute()
        for doc in docs_result.data or []:
            old_drive_id_result = supabase.table("templates").select("drive_file_id").eq("id", doc["id"]).execute()
            if old_drive_id_result.data and old_drive_id_result.data[0].get("drive_file_id"):
                try:
                    byod_service.delete_from_drive(supabase, user_id, old_drive_id_result.data[0]["drive_file_id"])
                except Exception:
                    pass
        supabase.table("templates").update(
            {"drive_file_id": None, "preview_status": "pending"}
        ).eq("user_id", user_id).execute()

        from drive_upload_worker import async_drive_upload_worker

        project_config = get_active_supabase_project_config()
        for doc in docs_result.data or []:
            if doc.get("original_file_path"):
                thread = threading.Thread(
                    target=async_drive_upload_worker,
                    args=(doc["id"], token, doc["name"], project_config.url, project_config.anon_key),
                )
                thread.daemon = True
                thread.start()

    return {"success": True, "folder_id": folder_id, "migration": migration_result if migrate_files else None}


@byod_router.get("/status")
async def get_status(token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    result = supabase.table("drive_connections").select("root_folder_id, updated_at").eq("user_id", user_id).execute()
    if not result.data:
        return {"connected": False}
    try:
        creds = byod_service.get_user_credentials(supabase, user_id)
        if creds:
            from googleapiclient.discovery import build

            service = build("drive", "v3", credentials=creds)
            about = service.about().get(fields="user").execute()
            user_info = about.get("user", {})
            return {
                "connected": True,
                "folder_id": result.data[0].get("root_folder_id"),
                "updated_at": result.data[0].get("updated_at"),
                "email": user_info.get("emailAddress"),
                "display_name": user_info.get("displayName"),
            }
    except Exception as exc:
        print(f"Error getting Google account info: {exc}")
    return {
        "connected": True,
        "folder_id": result.data[0].get("root_folder_id"),
        "updated_at": result.data[0].get("updated_at"),
    }


@byod_router.delete("/disconnect")
async def disconnect_drive(token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    docs_result = supabase.table("templates").select("drive_file_id, name").eq("user_id", user_id).execute()
    deleted_count = 0
    for doc in docs_result.data or []:
        if doc.get("drive_file_id"):
            try:
                byod_service.delete_from_drive(supabase, user_id, doc["drive_file_id"])
                deleted_count += 1
            except Exception:
                pass
    supabase.table("templates").update(
        {"drive_file_id": None, "preview_status": "not_configured"}
    ).eq("user_id", user_id).execute()
    supabase.table("drive_connections").delete().eq("user_id", user_id).execute()
    return {"success": True, "files_deleted": deleted_count, "message": "Google Drive disconnected successfully"}


@byod_router.post("/upload-preview")
async def upload_preview(file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    file_bytes = await file.read()
    drive_file_id = byod_service.upload_bytes_to_drive(
        supabase,
        user_id,
        file_bytes,
        f"preview_temp_{file.filename}",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        is_temporary=True,
    )
    if not drive_file_id:
        raise HTTPException(status_code=500, detail="Failed to upload to Google Drive")
    return {"success": True, "drive_file_id": drive_file_id}


@byod_router.delete("/preview/{file_id}")
async def delete_preview(file_id: str, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    byod_service.delete_from_drive(supabase, user.user.id, file_id)
    return {"success": True}

