from fastapi import APIRouter, HTTPException, Depends, Header, Request, Body
from typing import Optional
from datetime import datetime, timedelta
from storage_service import get_user_supabase_client
from byok_encryption import byok_crypto
from byod_service import byod_service, SCOPES
from google_auth_oauthlib.flow import Flow
import os
import json
import urllib.parse
import requests
from google.oauth2.credentials import Credentials

byod_router = APIRouter(prefix="/api/byod", tags=["BYOD"])

def get_jwt_token(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None

def get_client_credentials():
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
        "prompt": "consent"
    }
    
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"url": auth_url}

@byod_router.post("/auth/callback")
async def auth_callback(
    data: dict = Body(...),
    token: Optional[str] = Depends(get_jwt_token)
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    code = data.get("code")
    redirect_uri = data.get("redirect_uri")
    
    client_id, client_secret = get_client_credentials()
    
    try:
        response = requests.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        })
        
        token_data = response.json()
        
        if response.status_code != 200 or "error" in token_data:
            raise Exception(token_data.get("error_description", str(token_data)))
            
        expires_in = token_data.get("expires_in", 3600)
        expiry = datetime.utcnow() + timedelta(seconds=expires_in)
        
        credentials = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
            expiry=expiry
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Google Auth Error: {str(e)}")
        
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        enc_access = byok_crypto.encrypt_api_key(credentials.token)
        enc_refresh = byok_crypto.encrypt_api_key(credentials.refresh_token) if credentials.refresh_token else None
        
        # Check if exists
        existing = supabase.table('drive_connections').select('id').eq('user_id', user_id).execute()
        
        connection_data = {
            'access_token': enc_access,
            'token_expiry': credentials.expiry.isoformat() + "Z" if credentials.expiry else None
        }
        if enc_refresh:
            connection_data['refresh_token'] = enc_refresh
            
        if existing.data:
            connection_data['updated_at'] = datetime.utcnow().isoformat()
            supabase.table('drive_connections').update(connection_data).eq('user_id', user_id).execute()
        else:
            connection_data['user_id'] = user_id
            supabase.table('drive_connections').insert(connection_data).execute()
            
        return {"success": True}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error handling tokens: {str(e)}")

@byod_router.post("/folder")
async def set_folder(
    data: dict = Body(...),
    token: Optional[str] = Depends(get_jwt_token)
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    folder_url = data.get("url")
    folder_id = byod_service.extract_folder_id(folder_url)
    
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    
    supabase.table('drive_connections').update({
        'root_folder_id': folder_id,
        'updated_at': datetime.utcnow().isoformat()
    }).eq('user_id', user_id).execute()
    
    return {"success": True, "folder_id": folder_id}

@byod_router.get("/status")
async def get_status(token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    supabase = get_user_supabase_client(token)
    user = supabase.auth.get_user()
    user_id = user.user.id
    
    result = supabase.table('drive_connections').select('root_folder_id, updated_at').eq('user_id', user_id).execute()
    if not result.data:
        return {"connected": False}
        
    return {
        "connected": True,
        "folder_id": result.data[0].get('root_folder_id'),
        "updated_at": result.data[0].get('updated_at')
    }

from fastapi import UploadFile, File

@byod_router.post("/upload-preview")
async def upload_preview(
    file: UploadFile = File(...),
    token: Optional[str] = Depends(get_jwt_token)
):
    """Upload a temporary preview file to Google Drive for modified document preview"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        file_bytes = await file.read()
        
        # Upload to Drive with a temporary prefix
        drive_file_id = byod_service.upload_bytes_to_drive(
            supabase, 
            user_id, 
            file_bytes, 
            f"preview_temp_{file.filename}",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            is_temporary=True
        )
        
        if not drive_file_id:
            raise HTTPException(status_code=500, detail="Failed to upload to Google Drive")
            
        return {
            "success": True,
            "drive_file_id": drive_file_id
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@byod_router.delete("/preview/{file_id}")
async def delete_preview(
    file_id: str,
    token: Optional[str] = Depends(get_jwt_token)
):
    """Delete a temporary preview file from Google Drive"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        byod_service.delete_from_drive(supabase, user_id, file_id)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
