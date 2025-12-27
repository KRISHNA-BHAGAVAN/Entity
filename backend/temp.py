# import os
# from dotenv import load_dotenv
# from typing import List, Dict, Any, Optional
# from supabase import create_client, Client, ClientOptions
# from datetime import datetime
# import uuid

# load_dotenv(override=True)

# # Supabase configuration
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# BUCKET_NAME = os.getenv("BUCKET_NAME")

# # Create base client for admin operations
# base_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# def get_user_supabase_client(jwt_token: str) -> Client:
#     supabase = create_client(
#         SUPABASE_URL,
#         SUPABASE_KEY,
#         options=ClientOptions(
#             persist_session=False,
#             auto_refresh_token=False
#         ),
#     )

#     supabase.auth.set_session(jwt_token, refresh_token="")

#     return supabase

# def sanitize_filename(name: str) -> str:
#     """Replace non-alphanumeric characters with underscores"""
#     return ''.join(c if c.isalnum() or c in '.-_' else '_' for c in name)

# # Events Operations
# def get_events(jwt_token: Optional[str] = None) -> List[Dict[str, Any]]:
#     """Get all events for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
#     result = supabase.table('events').select('*').order('created_at', desc=True).execute()
#     return [{
#         'id': e['id'],
#         'name': e['name'],
#         'description': e['description'],
#         'createdAt': e['created_at']
#     } for e in result.data]

# def save_event(event: Dict[str, Any], jwt_token: Optional[str] = None) -> None:
#     """Save or update event for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
    
#     # Get user from current session
#     user = supabase.auth.get_user()
#     user_id = user.user.id if user.user else None
    
#     event_data = {
#         'id': event['id'],
#         'name': event['name'],
#         'description': event['description'],
#         'created_at': event['createdAt']
#     }
    
#     if user_id:
#         event_data['user_id'] = user_id
    
#     supabase.table('events').upsert(event_data).execute()

# def delete_event(event_id: str, jwt_token: Optional[str] = None) -> None:
#     """Delete event and associated docs for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
#     # Delete associated templates
#     supabase.table('templates').delete().eq('event_id', event_id).execute()
#     # Delete event
#     supabase.table('events').delete().eq('id', event_id).execute()

# # Document Operations
# def get_docs(event_id: Optional[str] = None, jwt_token: Optional[str] = None) -> List[Dict[str, Any]]:
#     """Get documents for the authenticated user, optionally filtered by event"""
#     try:
#         supabase = get_user_supabase_client(jwt_token)
#         query = supabase.table('templates').select('*')
#         if event_id:
#             query = query.eq('event_id', event_id)
        
#         result = query.execute()
#         if not result.data:
#             return []
            
#         return [{
#             'id': d['id'],
#             'eventId': d['event_id'],
#             'name': d['name'],
#             'originalFilePath': d['original_file_path'],
#             'templateFilePath': d['template_file_path'],
#             'variables': d['variables'] or [],
#             'uploadDate': d['upload_date']
#         } for d in result.data]
#     except Exception as e:
#         print(f"Error in get_docs: {e}")
#         raise e

# def upload_doc(event_id: str, name: str, file_bytes: bytes, jwt_token: Optional[str] = None) -> str:
#     """Upload document for the authenticated user and return doc ID"""
#     supabase = get_user_supabase_client(jwt_token)
#     doc_id = str(uuid.uuid4())
#     safe_filename = sanitize_filename(name)
    
#     # Get user ID from JWT if available, otherwise use anonymous
#     user_id = 'anonymous'
#     if jwt_token:
#         try:
#             # Extract user ID from JWT payload (simplified)
#             import jwt
#             payload = jwt.decode(jwt_token, options={"verify_signature": False})
#             user_id = payload.get('sub', 'anonymous')
#         except:
#             user_id = 'anonymous'
    
#     file_path = f"{user_id}/{event_id}/{doc_id}/{safe_filename}"
    
#     # Upload to storage
#     supabase.storage.from_(BUCKET_NAME).upload(
#         path=file_path,
#         file=file_bytes,
#         file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
#     )
    
#     # Save metadata
#     supabase.table('templates').insert({
#         'id': doc_id,
#         'event_id': event_id,
#         'name': name,
#         'original_file_path': file_path,
#         'template_file_path': file_path,
#         'variables': [],
#         'upload_date': datetime.now().isoformat()
#     }).execute()
    
#     return doc_id

# def download_doc(doc_id: str, jwt_token: Optional[str] = None) -> bytes:
#     """Download document by ID for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
#     # Get file path from database
#     result = supabase.table('templates').select('original_file_path').eq('id', doc_id).single().execute()
#     file_path = result.data['original_file_path']
    
#     # Download from storage
#     result = supabase.storage.from_(BUCKET_NAME).download(file_path)
#     return result

# def update_doc_template(doc_id: str, variables: List[Dict[str, Any]], template_bytes: bytes, jwt_token: Optional[str] = None) -> None:
#     """Update document template with variables for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
#     # Get existing doc
#     result = supabase.table('templates').select('*').eq('id', doc_id).single().execute()
#     doc = result.data
    
#     # Create template file path
#     safe_filename = sanitize_filename(doc['name'])
#     template_path = f"{doc['original_file_path'].split('/')[0]}/{doc['event_id']}/{doc_id}/{safe_filename}_template"
    
#     # Upload template
#     supabase.storage.from_(BUCKET_NAME).upload(
#         path=template_path,
#         file=template_bytes,
#         file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
#     )
    
#     # Update metadata
#     supabase.table('templates').update({
#         'template_file_path': template_path,
#         'variables': variables
#     }).eq('id', doc_id).execute()

# def delete_doc(doc_id: str, jwt_token: Optional[str] = None) -> None:
#     """Delete document for the authenticated user"""
#     supabase = get_user_supabase_client(jwt_token)
#     # Get file paths
#     result = supabase.table('templates').select('original_file_path', 'template_file_path').eq('id', doc_id).single().execute()
#     doc = result.data
    
#     # Delete files from storage
#     paths_to_delete = [doc['original_file_path']]
#     if doc['template_file_path'] != doc['original_file_path']:
#         paths_to_delete.append(doc['template_file_path'])
    
#     supabase.storage.from_(BUCKET_NAME).remove(paths_to_delete)
    
#     # Delete from database
#     supabase.table('templates').delete().eq('id', doc_id).execute()