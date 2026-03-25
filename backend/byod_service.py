import os
import re
import io
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.auth.transport.requests import Request
from storage_service import get_user_supabase_client
from byok_encryption import byok_crypto

SCOPES = ['https://www.googleapis.com/auth/drive.file']

class BYODService:
    @staticmethod
    def extract_folder_id(url_or_id: str) -> str:
        # e.g., https://drive.google.com/drive/folders/1abc123...
        match = re.search(r'folders/([a-zA-Z0-9-_]+)', url_or_id)
        if match:
            return match.group(1)
        return url_or_id.strip()

    @staticmethod
    def get_user_credentials(supabase, user_id: str) -> Optional[Credentials]:
        result = supabase.table('drive_connections').select('*').eq('user_id', user_id).execute()
        if not result.data:
            return None
            
        data = result.data[0]
        access_token = byok_crypto.decrypt_api_key(data['access_token'])
        refresh_token = byok_crypto.decrypt_api_key(data['refresh_token']) if data.get('refresh_token') else None
        
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv('GOOGLE_CLIENT_ID', 'DUMMY_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET', 'DUMMY_CLIENT_SECRET'),
            scopes=SCOPES
        )
        
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save the new token
            new_ext = byok_crypto.encrypt_api_key(creds.token)
            supabase.table('drive_connections').update({
                'access_token': new_ext,
                'token_expiry': creds.expiry.isoformat() + 'Z' if creds.expiry else None
            }).eq('user_id', user_id).execute()
            
        return creds

    @staticmethod
    def upload_bytes_to_drive(supabase, user_id: str, file_bytes: bytes, file_name: str, mimetype: str, is_temporary: bool = False) -> Optional[str]:
        creds = BYODService.get_user_credentials(supabase, user_id)
        if not creds:
            print(f"No Google Drive credentials found for user {user_id}")
            return None
            
        service = build('drive', 'v3', credentials=creds)
        
        # get folder ID
        result = supabase.table('drive_connections').select('root_folder_id').eq('user_id', user_id).execute()
        folder_id = result.data[0].get('root_folder_id') if result.data else None
        
        if not folder_id:
            print(f"No root folder configured for user {user_id}")
        
        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        # For temporary files, add description to identify them later
        if is_temporary:
            file_metadata['description'] = 'temporary_preview_file'
            
        media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mimetype, resumable=True)
        try:
            file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            print(f"Successfully uploaded {file_name} to Drive with ID: {file.get('id')}")
            return file.get('id')
        except Exception as e:
            print(f"Failed to upload bytes to drive: {e}")
            import traceback
            traceback.print_exc()
            return None
        
    @staticmethod
    def delete_from_drive(supabase, user_id: str, drive_file_id: str) -> bool:
        creds = BYODService.get_user_credentials(supabase, user_id)
        if not creds:
            return False
        service = build('drive', 'v3', credentials=creds)
        try:
            service.files().delete(fileId=drive_file_id).execute()
            return True
        except Exception as e:
            print(f"Failed to delete from drive: {e}")
            return False
    
    @staticmethod
    def move_file_to_folder(supabase, user_id: str, drive_file_id: str, new_folder_id: str) -> bool:
        """Move a file from its current location to a new folder"""
        creds = BYODService.get_user_credentials(supabase, user_id)
        if not creds:
            return False
        service = build('drive', 'v3', credentials=creds)
        try:
            # Get current parents
            file = service.files().get(fileId=drive_file_id, fields='parents').execute()
            previous_parents = ",".join(file.get('parents', []))
            
            # Move file to new folder
            service.files().update(
                fileId=drive_file_id,
                addParents=new_folder_id,
                removeParents=previous_parents,
                fields='id, parents'
            ).execute()
            return True
        except Exception as e:
            print(f"Failed to move file to folder: {e}")
            return False

byod_service = BYODService()
