from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class BYOKAddRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None

    @model_validator(mode="after")
    def ensure_credentials(self):
        if self.credentials:
            return self
        credentials: Dict[str, Any] = {}
        if self.api_key:
            credentials["api_key"] = self.api_key
        if self.base_url:
            credentials["base_url"] = self.base_url
        self.credentials = credentials or None
        return self


class BYOKValidateRequest(BaseModel):
    provider: str
    model: Optional[str] = None


class BYOKKeyInfo(BaseModel):
    provider: str
    model: Optional[str]
    status: str
    last_used_at: Optional[str]
    last_validated_at: Optional[str]
    created_at: str


class ProviderCatalogResponse(BaseModel):
    providers: List[Dict[str, Any]] = Field(default_factory=list)

