import os
import tempfile
import hashlib
import zipfile
from replace import replace_text_in_document

def validate_docx_structure(file_path: str) -> bool:
    """Validate DOCX file structure"""
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_file:
            zip_file.testzip()
            required_files = ['[Content_Types].xml', 'word/document.xml']
            for req_file in required_files:
                if req_file not in zip_file.namelist():
                    print(f"Missing required file: {req_file}")
                    return False
            print(f"DOCX structure valid. Files: {len(zip_file.namelist())}")
            return True
    except zipfile.BadZipFile:
        print("File is not a valid ZIP/DOCX")
        return False

def test_file_integrity(file_path: str):
    """Test file integrity through processing pipeline"""
    print(f"=== Testing File Integrity: {file_path} ===")
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    # Step 1: Original file validation
    with open(file_path, 'rb') as f:
        original_bytes = f.read()
    
    original_hash = hashlib.md5(original_bytes).hexdigest()
    print(f"Original file: size={len(original_bytes)}, hash={original_hash}")
    print("Original file structure:", end=" ")
    validate_docx_structure(file_path)
    
    # Step 2: Test replacements
    test_replacements = [
        ("REGISTRATION FORM", "PROCESSED FORM"),
        ("Build Web/Enterprise Applications using SpringBoot WITH REST API", "Build Application using Generative AI")
    ]
    
    # Step 3: Process with replace_text_in_document
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_output:
        temp_output_path = temp_output.name
    
    try:
        print(f"\nProcessing with {len(test_replacements)} replacements...")
        result = replace_text_in_document(
            input_paths=file_path,
            output_paths=temp_output_path,
            replacements=test_replacements,
            match_case=False
        )
        
        print(f"Processing result: {result}")
        
        # Step 4: Validate processed file
        if os.path.exists(temp_output_path):
            with open(temp_output_path, 'rb') as f:
                processed_bytes = f.read()
            
            processed_hash = hashlib.md5(processed_bytes).hexdigest()
            print(f"Processed file: size={len(processed_bytes)}, hash={processed_hash}")
            print("Processed file structure:", end=" ")
            is_valid = validate_docx_structure(temp_output_path)
            
            # Step 5: Compare sizes
            size_diff = len(processed_bytes) - len(original_bytes)
            print(f"Size difference: {size_diff} bytes")
            
            if is_valid:
                print("File processing successful - structure maintained")
            else:
                print("File processing corrupted the structure")
                
            # Step 6: Simulate web transfer (read/write cycle)
            print("\nSimulating web transfer...")
            with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_transfer:
                temp_transfer_path = temp_transfer.name
            
            # Write and read back (simulating HTTP transfer)
            with open(temp_transfer_path, 'wb') as f:
                f.write(processed_bytes)
            
            with open(temp_transfer_path, 'rb') as f:
                transferred_bytes = f.read()
            
            transferred_hash = hashlib.md5(transferred_bytes).hexdigest()
            print(f"After transfer: size={len(transferred_bytes)}, hash={transferred_hash}")
            
            if processed_hash == transferred_hash:
                print("File transfer integrity maintained")
            else:
                print("File corrupted during transfer simulation")
            
            print("Transfer file structure:", end=" ")
            validate_docx_structure(temp_transfer_path)
            
            os.unlink(temp_transfer_path)
        else:
            print("Processed file not created")
    
    finally:
        if os.path.exists(temp_output_path):
            os.unlink(temp_output_path)

if __name__ == "__main__":
    # Test with existing file
    test_file =  r"C:\Users\Krishna Bhagavan\projects\experiments\docs\3.Brouche -springboot-a.docx"
    
    if os.path.exists(test_file):
        test_file_integrity(test_file)
    else:
        print(f"Test file {test_file} not found.")
        print("Available files:")
        for f in os.listdir("."):
            if f.endswith('.docx'):
                print(f"  - {f}")