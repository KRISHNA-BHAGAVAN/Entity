import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from extract import docx_bytes_to_markdown_for_preview
from replace import replace_text_in_document_bytes
from agent import variable_suggestion_chain
from storage_service import (
    get_events, save_event, delete_event,
    get_docs, upload_doc, download_doc, update_doc_template, delete_doc
)
from langserve import add_routes
import tempfile, os

# Set up the FastAPI app and add routes
app = FastAPI(
    title="Document Processing API",
    version="1.0",
    description="API server for document processing and variable suggestions.",
    docs_url="/swagger"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Token extraction
def get_jwt_token(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]  # Remove "Bearer " prefix
    return None

# Expose the chain via LangServe
add_routes(
    app,
    variable_suggestion_chain,
    path="/suggest_variables",
)

@app.post("/extract-markdown")
async def extract_markdown(file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    if not file.filename or not file.filename.endswith('.docx'):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    
    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        markdown = docx_bytes_to_markdown_for_preview(file_bytes)
        return {"markdown": markdown}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/replace-text/{doc_id}")
async def replace_text(
    doc_id: str,
    replacements_json: str = Form(...),
    token: Optional[str] = Depends(get_jwt_token)
):
    try:
        replacements = json.loads(replacements_json)
        file_bytes = download_doc(doc_id, token)

        # Call the new bytes function
        output_file, count = replace_text_in_document_bytes(file_bytes, replacements)
        
        # Return the file as a stream
        return StreamingResponse(
            output_file,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="processed_document.docx"',
                "X-Total-Replacements": str(count) # Custom header to send the count
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Pydantic models
class Event(BaseModel):
    id: str
    name: str
    description: str
    createdAt: str

class Variable(BaseModel):
    variableName: str
    originalText: str

# Storage endpoints
@app.get("/events")
async def list_events(token: Optional[str] = Depends(get_jwt_token)):
    try:
        events = get_events(token)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/events")
async def create_event(event: Event, token: Optional[str] = Depends(get_jwt_token)):
    try:
        save_event(event.model_dump(), token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/events/{event_id}")
async def remove_event(event_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        delete_event(event_id, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs")
async def list_docs(event_id: Optional[str] = None, token: Optional[str] = Depends(get_jwt_token)):
    try:
        docs = get_docs(event_id, token)
        return {"docs": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/docs")
async def upload_document(event_id: str = Form(...), name: str = Form(...), file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    try:
        file_bytes = await file.read()
        doc_id = upload_doc(event_id, name, file_bytes, token)
        return {"docId": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs/{doc_id}")
async def download_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        file_bytes = download_doc(doc_id, token)
        return Response(
            content=file_bytes,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={'Content-Disposition': 'attachment; filename="document.docx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/docs/{doc_id}/template")
async def update_template(doc_id: str, variables: str = Form(...), file: UploadFile = File(...), token: Optional[str] = Depends(get_jwt_token)):
    try:
        import json
        variables_list = json.loads(variables)
        file_bytes = await file.read()
        update_doc_template(doc_id, variables_list, file_bytes, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/docs/{doc_id}")
async def remove_document(doc_id: str, token: Optional[str] = Depends(get_jwt_token)):
    try:
        delete_doc(doc_id, token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
