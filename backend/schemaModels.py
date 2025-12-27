from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DocumentIn(BaseModel):
    filename: str
    markdown: str
    docx_path: Optional[str] = None

class SchemaDiscoveryRequest(BaseModel):
    documents: List[DocumentIn]

class TableEdit(BaseModel):
    table_index: int
    row: int
    col: int
    old_value: str
    new_value: str