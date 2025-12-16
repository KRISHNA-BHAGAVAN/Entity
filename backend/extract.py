from pathlib import Path
import re
from markitdown import MarkItDown  # type: ignore
from io import BytesIO


# Remove any markdown image: ![...](...)
IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\([^)]*\)", re.IGNORECASE)

def docx_bytes_to_markdown_for_preview(file_bytes: bytes) -> str:
    md = MarkItDown(enable_plugins=True)
    
    # Use BytesIO to turn bytes into a "file-like" stream
    # Important: convert_stream often requires the original filename/extension 
    # to know which converter to use (e.g., .docx vs .pdf)
    file_stream = BytesIO(file_bytes)
    
    # Use convert_stream for file-like objects
    result = md.convert_stream(file_stream, file_extension=".docx")
    
    markdown = result.text_content or ""
    
    # cleanup logic
    markdown = IMAGE_PATTERN.sub("", markdown)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    return markdown.strip()

# if __name__ == "__main__":
#     docx_path = r"C:\Users\Krishna Bhagavan\projects\entity\docs\3.Brouche -springboot-a.docx"
#     text = docx_to_markdown_for_preview(docx_path)
#     print(text)
