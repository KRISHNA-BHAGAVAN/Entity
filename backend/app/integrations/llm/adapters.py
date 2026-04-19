from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional

import requests

from app.core.errors import ProviderValidationError
from app.integrations.llm.types import Credentials, ModelDescriptor, ProviderSpec, ValidationResult


class BaseLLMProviderAdapter(ABC):
    def __init__(self, spec: ProviderSpec):
        self.spec = spec

    @abstractmethod
    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        raise NotImplementedError

    @abstractmethod
    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        raise NotImplementedError

    def healthcheck(self, credentials: Credentials) -> ValidationResult:
        return self.validate_credentials(credentials)

    def validate_credentials(
        self,
        credentials: Credentials,
        model: Optional[str] = None,
    ) -> ValidationResult:
        try:
            available_models = self.list_models(credentials)
        except Exception as exc:
            return ValidationResult(ok=False, message=str(exc))

        if model:
            available_ids = self._candidate_model_ids(available_models)
            if model not in available_ids:
                return ValidationResult(
                    ok=False,
                    message=f"Model '{model}' not found or not supported by {self.spec.name}",
                    available_models=available_models,
                )
        return ValidationResult(ok=True, available_models=available_models)

    def validate_key(self, api_key: str, model: Optional[str] = None) -> bool:
        return self.validate_credentials({"api_key": api_key}, model=model).ok

    def create_llm(self, api_key: str, model: Optional[str] = None, **options) -> Any:
        return self.create_chat_model({"api_key": api_key}, model or self.spec.default_model, **options)

    @staticmethod
    def _candidate_model_ids(models: Iterable[ModelDescriptor]) -> set[str]:
        ids = {model.id for model in models}
        for model in list(ids):
            if ":" in model:
                ids.add(model.split(":", 1)[0])
        return ids


class OpenAIAdapter(BaseLLMProviderAdapter):
    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        api_key = credentials.get("api_key")
        if not api_key:
            raise ProviderValidationError("API key is required")
        response = requests.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=15,
        )
        if response.status_code == 401:
            raise ProviderValidationError("Invalid API Key")
        response.raise_for_status()
        models = response.json().get("data", [])
        return [ModelDescriptor(id=item["id"], label=item["id"], source="runtime") for item in models if item.get("id")]

    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(api_key=credentials["api_key"], model=model, **options)


class GeminiAdapter(BaseLLMProviderAdapter):
    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        api_key = credentials.get("api_key")
        if not api_key:
            raise ProviderValidationError("API key is required")
        response = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            timeout=15,
        )
        if response.status_code == 400 or response.status_code == 401:
            raise ProviderValidationError("Invalid API Key")
        response.raise_for_status()
        models = response.json().get("models", [])
        return [
            ModelDescriptor(
                id=item["name"].replace("models/", ""),
                label=item["name"].replace("models/", ""),
                source="runtime",
            )
            for item in models
            if item.get("name")
        ]

    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(api_key=credentials["api_key"], model=model, **options)


class GroqAdapter(BaseLLMProviderAdapter):
    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        api_key = credentials.get("api_key")
        if not api_key:
            raise ProviderValidationError("API key is required")
        response = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=15,
        )
        if response.status_code == 401:
            raise ProviderValidationError("Invalid API Key")
        response.raise_for_status()
        models = response.json().get("data", [])
        return [ModelDescriptor(id=item["id"], label=item["id"], source="runtime") for item in models if item.get("id")]

    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        from langchain_groq import ChatGroq

        return ChatGroq(api_key=credentials["api_key"], model=model, **options)


class AnthropicAdapter(BaseLLMProviderAdapter):
    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        api_key = credentials.get("api_key")
        if not api_key:
            raise ProviderValidationError("API key is required")
        response = requests.get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            timeout=15,
        )
        if response.status_code == 401:
            raise ProviderValidationError("Invalid API Key")
        response.raise_for_status()
        models = response.json().get("data", [])
        return [ModelDescriptor(id=item["id"], label=item["display_name"], source="runtime") for item in models if item.get("id")]

    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(api_key=credentials["api_key"], model=model, **options)


class OllamaAdapter(BaseLLMProviderAdapter):
    LOCAL_HOST = "http://localhost:11434"
    CLOUD_HOST = "https://ollama.com"

    def list_models(self, credentials: Credentials) -> List[ModelDescriptor]:
        api_base_url = self.resolve_api_base_url(credentials)
        headers = self.build_request_headers(credentials)
        response = requests.get(f"{api_base_url}/tags", headers=headers or None, timeout=15)

        if response.status_code in {401, 403}:
            raise ProviderValidationError("Invalid Ollama API key")
        if response.status_code >= 400:
            host = api_base_url.rsplit("/api", 1)[0]
            raise ProviderValidationError(f"Failed to reach Ollama at {host}")

        response.raise_for_status()
        models = response.json().get("models", [])
        if models:
            return [
                ModelDescriptor(id=item["name"], label=item["name"], source="runtime")
                for item in models
                if item.get("name")
            ]

        openai_base_url = self.resolve_openai_base_url(credentials)
        openai_response = requests.get(f"{openai_base_url}/models", headers=headers or None, timeout=15)
        if openai_response.status_code in {401, 403}:
            raise ProviderValidationError("Invalid Ollama API key")
        if openai_response.status_code >= 400:
            host = openai_base_url.rsplit("/v1", 1)[0]
            raise ProviderValidationError(f"Failed to list Ollama models at {host}")

        openai_response.raise_for_status()
        openai_models = openai_response.json().get("data", [])
        return [
            ModelDescriptor(id=item["id"], label=item["id"], source="runtime")
            for item in openai_models
            if item.get("id")
        ]

    def create_chat_model(self, credentials: Credentials, model: str, **options) -> Any:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            api_key=credentials.get("api_key") or "ollama",
            base_url=self.resolve_openai_base_url(credentials),
            model=model,
            **options,
        )

    def validate_credentials(
        self,
        credentials: Credentials,
        model: Optional[str] = None,
    ) -> ValidationResult:
        result = super().validate_credentials(credentials, model=model)
        if result.ok or not model:
            return result

        # Ollama often exposes runtime tags such as `llama3.1:latest`.
        runtime_ids = {descriptor.id for descriptor in result.available_models}
        if any(candidate.split(":", 1)[0] == model for candidate in runtime_ids):
            return ValidationResult(ok=True, available_models=result.available_models)
        return result

    def resolve_api_base_url(self, credentials: Credentials) -> str:
        host = self._resolve_host(credentials)
        self._ensure_host_auth_constraints(host, credentials)
        return f"{host}/api"

    def resolve_openai_base_url(self, credentials: Credentials) -> str:
        host = self._resolve_host(credentials)
        self._ensure_host_auth_constraints(host, credentials)
        return f"{host}/v1"

    def build_request_headers(self, credentials: Credentials) -> Dict[str, str]:
        api_key = (credentials.get("api_key") or "").strip()
        if not api_key:
            return {}
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _resolve_host(self, credentials: Credentials) -> str:
        explicit_host = self._normalize_host(credentials.get("base_url"))
        if explicit_host:
            return explicit_host
        if (credentials.get("api_key") or "").strip():
            return self.CLOUD_HOST
        return self.LOCAL_HOST

    def _ensure_host_auth_constraints(self, host: str, credentials: Credentials) -> None:
        if host == self.CLOUD_HOST and not (credentials.get("api_key") or "").strip():
            raise ProviderValidationError(
                "Ollama Cloud requires an API key when using https://ollama.com directly"
            )

    @staticmethod
    def _normalize_host(base_url: Optional[str]) -> Optional[str]:
        if not base_url:
            return None
        cleaned = base_url.rstrip("/")
        for suffix in ("/api", "/v1"):
            if cleaned.endswith(suffix):
                cleaned = cleaned[: -len(suffix)]
                break
        return cleaned
