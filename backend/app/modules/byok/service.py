from typing import Any, Dict, Optional

from app.integrations.llm.broker import key_broker
from app.integrations.llm.registry import get_provider_catalog


def list_provider_catalog() -> Dict[str, Any]:
    return {"providers": get_provider_catalog()}


def normalize_credentials(payload_credentials: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {key: value for key, value in (payload_credentials or {}).items() if value not in (None, "")}


__all__ = ["key_broker", "list_provider_catalog", "normalize_credentials"]

