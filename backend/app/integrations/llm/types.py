from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

ProviderId = Literal["openai", "gemini", "groq", "anthropic", "ollama"]


@dataclass(frozen=True)
class CredentialField:
    name: str
    label: str
    required: bool = True
    secret: bool = True
    input_type: str = "password"
    placeholder: Optional[str] = None
    help_text: Optional[str] = None


@dataclass(frozen=True)
class ModelDescriptor:
    id: str
    label: str
    recommended: bool = False
    source: str = "docs"
    context_window: Optional[int] = None


@dataclass(frozen=True)
class ProviderSpec:
    id: ProviderId
    name: str
    description: str
    credential_fields: List[CredentialField]
    recommended_models: List[ModelDescriptor]
    default_model: str
    runtime_model_discovery: bool = True
    docs_url: Optional[str] = None


@dataclass
class ValidationResult:
    ok: bool
    message: str = ""
    available_models: List[ModelDescriptor] = field(default_factory=list)

    def raise_for_error(self) -> None:
        if not self.ok:
            raise ValueError(self.message)


Credentials = Dict[str, Any]

