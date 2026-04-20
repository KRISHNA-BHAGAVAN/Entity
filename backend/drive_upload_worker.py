"""Background worker for uploading documents to Google Drive"""
from storage_service import download_doc, get_user_supabase_client
from byod_service import byod_service


def async_drive_upload_worker(
    doc_id: str,
    token: str,
    file_name: str,
    supabase_url: str | None = None,
    supabase_key: str | None = None,
):
    """Upload a document to Google Drive in the background"""
    try:
        supabase = get_user_supabase_client(token, supabase_url=supabase_url, supabase_key=supabase_key)
        user_id = supabase.auth.get_user().user.id
        
        file_bytes = download_doc(doc_id, token, supabase_url=supabase_url, supabase_key=supabase_key)
        
        drive_file_id = byod_service.upload_bytes_to_drive(
            supabase, user_id, file_bytes, file_name, 
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
        if drive_file_id:
            supabase.table('templates').update({
                'drive_file_id': drive_file_id,
                'preview_status': 'ready'
            }).eq('id', doc_id).execute()
        else:
            supabase.table('templates').update({
                'preview_status': 'failed'
            }).eq('id', doc_id).execute()
    except Exception as e:
        print(f"Drive upload failed for {doc_id}: {e}")
        try:
            supabase = get_user_supabase_client(token, supabase_url=supabase_url, supabase_key=supabase_key)
            supabase.table('templates').update({
                'preview_status': 'error'
            }).eq('id', doc_id).execute()
        except:
            pass
