import os
import tempfile
import hashlib
from supabase import create_client, Client
from replace import replace_text_in_document

# Supabase configuration
SUPABASE_URL = "https://wsadegzzmafyxwkjwexk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWRlZ3p6bWFmeXh3a2p3ZXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTE2OTUsImV4cCI6MjA4MDk2NzY5NX0.f9XVehbpxKRdee0_E3EXrfHCmKuIlVsYI6ppGK73-u0"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_docx_to_supabase(file_path: str, bucket_name: str = "documents") -> str:
    """Upload DOCX file to Supabase storage and return public URL"""
    filename = os.path.basename(file_path)
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    # Calculate hash for verification
    file_hash = hashlib.md5(file_data).hexdigest()
    print(f"Uploading {filename}: size={len(file_data)}, hash={file_hash}")
    
    # Upload to Supabase
    result = supabase.storage.from_(bucket_name).upload(
        path=filename,
        file=file_data,
        file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    )
    
    if result.data:
        print(f"Upload successful: {result.data}")
        return filename
    else:
        print(f"Upload failed: {result}")
        return None

def download_docx_from_supabase(filename: str, bucket_name: str = "documents") -> bytes:
    """Download DOCX file from Supabase storage"""
    result = supabase.storage.from_(bucket_name).download(filename)
    
    if result:
        file_hash = hashlib.md5(result).hexdigest()
        print(f"Downloaded {filename}: size={len(result)}, hash={file_hash}")
        return result
    else:
        print(f"Download failed for {filename}")
        return None

def test_docx_processing_with_supabase(local_docx_path: str):
    """Test complete flow: upload -> download -> process -> verify"""
    print("=== DOCX Processing Test with Supabase ===")
    
    # Step 1: Upload original file
    print("\n1. Uploading original file to Supabase...")
    uploaded_filename = upload_docx_to_supabase(local_docx_path)
    if not uploaded_filename:
        print("Upload failed, aborting test")
        return
    
    # Step 2: Download file from Supabase
    print("\n2. Downloading file from Supabase...")
    downloaded_bytes = download_docx_from_supabase(uploaded_filename)
    if not downloaded_bytes:
        print("Download failed, aborting test")
        return
    
    # Step 3: Save downloaded file and process with replace_text_in_document
    print("\n3. Processing downloaded file...")
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_input:
        temp_input.write(downloaded_bytes)
        temp_input_path = temp_input.name
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_output:
        temp_output_path = temp_output.name
    
    # Test replacements
    test_replacements = [
        ("{{companyName}}", "Test Company Inc"),
        ("{{date}}", "2024-12-15"),
        ("REGISTRATION FORM", "PROCESSED FORM")
    ]
    
    try:
        result = replace_text_in_document(
            input_paths=temp_input_path,
            output_paths=temp_output_path,
            replacements=test_replacements,
            match_case=False
        )
        
        print(f"Processing result: {result}")
        
        # Step 4: Verify processed file
        if os.path.exists(temp_output_path):
            with open(temp_output_path, 'rb') as f:
                processed_bytes = f.read()
            
            processed_hash = hashlib.md5(processed_bytes).hexdigest()
            print(f"Processed file: size={len(processed_bytes)}, hash={processed_hash}")
            
            # Step 5: Upload processed file back to Supabase
            print("\n4. Uploading processed file to Supabase...")
            processed_filename = f"processed_{uploaded_filename}"
            
            with open(temp_output_path, 'rb') as f:
                upload_result = supabase.storage.from_("documents").upload(
                    path=processed_filename,
                    file=f.read(),
                    file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                )
            
            if upload_result.data:
                print(f"Processed file uploaded successfully: {processed_filename}")
                
                # Step 6: Download processed file and verify
                print("\n5. Downloading processed file for verification...")
                final_bytes = download_docx_from_supabase(processed_filename)
                if final_bytes:
                    final_hash = hashlib.md5(final_bytes).hexdigest()
                    print(f"Final verification: size={len(final_bytes)}, hash={final_hash}")
                    
                    # Compare hashes
                    if processed_hash == final_hash:
                        print("✅ File integrity maintained through Supabase upload/download")
                    else:
                        print("❌ File corruption detected in Supabase transfer")
            else:
                print(f"Failed to upload processed file: {upload_result}")
        
    finally:
        # Cleanup temp files
        if os.path.exists(temp_input_path):
            os.unlink(temp_input_path)
        if os.path.exists(temp_output_path):
            os.unlink(temp_output_path)

if __name__ == "__main__":
    # Test with a local DOCX file
    test_file = "multiple_modified_1.docx"  # Use existing test file
    
    if os.path.exists(test_file):
        test_docx_processing_with_supabase(test_file)
    else:
        print(f"Test file {test_file} not found. Please provide a valid DOCX file path.")