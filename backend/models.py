# models.py
from pydantic import BaseModel, model_validator
from typing import List, Optional, Any 


class QueryRequest(BaseModel):
    """Defines the structure for the incoming API request."""
    documents: Optional[str] = None
    url: Optional[str] = None
    query: Optional[str] = None  # New field for Round 6 code generation
    questions: List[str]
    is_url_request: bool = False
    is_code_request: bool = False

    @model_validator(mode='before')
    @classmethod
    def normalize_and_track_input(cls, data: Any) -> Any:
        """
        Validates input, supports url (web challenges), query (code generation),
        and documents (legacy) fields with proper prioritization.
        """
        if not isinstance(data, dict):
            return data

        url = data.get("url")
        query = data.get("query")
        documents = data.get("documents")

        # Round 6: Code generation mode
        if query:
            data["is_code_request"] = True
            data["is_url_request"] = False
        # Rounds 1-5: Web challenge mode
        elif url:
            data["is_url_request"] = True
            data["is_code_request"] = False
            data["documents"] = url
        # Legacy: Documents mode
        elif documents:
            data["is_url_request"] = False
            data["is_code_request"] = False
        else:
            raise ValueError("Either 'documents', 'url', or 'query' must be provided.")

        return data


class QueryResponse(BaseModel):
    """Defines the structure for the API response."""
    answers: List[str]