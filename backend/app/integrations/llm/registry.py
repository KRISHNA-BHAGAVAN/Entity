from __future__ import annotations

from typing import Dict, List

from app.integrations.llm.adapters import (
    AnthropicAdapter,
    GeminiAdapter,
    GroqAdapter,
    OllamaAdapter,
    OpenAIAdapter,
)
from app.integrations.llm.types import CredentialField, ModelDescriptor, ProviderId, ProviderSpec


PROVIDER_SPECS: Dict[ProviderId, ProviderSpec] = {
    "openai": ProviderSpec(
        id="openai",
        name="OpenAI",
        description="Hosted OpenAI chat models.",
        credential_fields=[
            CredentialField(name="api_key", label="API Key", placeholder="sk-...")
        ],
        recommended_models=[
            ModelDescriptor(id="gpt-5.4", label="gpt-5.4", recommended=True),
            ModelDescriptor(id="gpt-5.4-mini", label="gpt-5.4-mini", recommended=True),
            ModelDescriptor(id="gpt-5.4-nano", label="gpt-5.4-nano"),
            ModelDescriptor(id="gpt-5.2", label="gpt-5.2"),
            ModelDescriptor(id="gpt-4.1", label="gpt-4.1"),
            ModelDescriptor(id="gpt-4.1-mini", label="gpt-4.1-mini"),
        ],
        default_model="gpt-5.4-mini",
        docs_url="https://developers.openai.com/api/docs/models",
    ),
    "gemini": ProviderSpec(
        id="gemini",
        name="Google Gemini",
        description="Google Gemini API models.",
        credential_fields=[
            CredentialField(name="api_key", label="API Key", placeholder="AIza...")
        ],
        recommended_models=[
            ModelDescriptor(id="gemini-2.5-pro", label="gemini-2.5-pro", recommended=True),
            ModelDescriptor(id="gemini-2.5-flash", label="gemini-2.5-flash", recommended=True),
            ModelDescriptor(id="gemini-2.5-flash-lite", label="gemini-2.5-flash-lite"),
        ],
        default_model="gemini-2.5-flash",
        docs_url="https://ai.google.dev/gemini-api/docs/models/gemini-v2",
    ),
    "groq": ProviderSpec(
        id="groq",
        name="Groq",
        description="Groq-hosted low-latency inference.",
        credential_fields=[
            CredentialField(name="api_key", label="API Key", placeholder="gsk_...")
        ],
        recommended_models=[
            ModelDescriptor(id="llama-3.3-70b-versatile", label="llama-3.3-70b-versatile", recommended=True),
            ModelDescriptor(id="llama-3.1-8b-instant", label="llama-3.1-8b-instant"),
            ModelDescriptor(id="openai/gpt-oss-120b", label="openai/gpt-oss-120b"),
        ],
        default_model="llama-3.3-70b-versatile",
        docs_url="https://console.groq.com/docs/models",
    ),
    "anthropic": ProviderSpec(
        id="anthropic",
        name="Anthropic",
        description="Claude hosted models from Anthropic.",
        credential_fields=[
            CredentialField(name="api_key", label="API Key", placeholder="sk-ant-...")
        ],
        recommended_models=[
            ModelDescriptor(id="claude-opus-4-1-20250805", label="claude-opus-4-1-20250805", recommended=True),
            ModelDescriptor(id="claude-sonnet-4-20250514", label="claude-sonnet-4-20250514", recommended=True),
            ModelDescriptor(id="claude-3-5-haiku-20241022", label="claude-3-5-haiku-20241022"),
        ],
        default_model="claude-sonnet-4-20250514",
        docs_url="https://docs.anthropic.com/en/docs/about-claude/models/all-models",
    ),
    "ollama": ProviderSpec(
        id="ollama",
        name="Ollama",
        description="Local Ollama daemon or direct Ollama Cloud API access.",
        credential_fields=[
            CredentialField(
                name="base_url",
                label="Host URL",
                required=False,
                placeholder="http://localhost:11434 or https://ollama.com",
                secret=False,
                input_type="url",
                help_text="Leave blank for the local Ollama daemon. Use https://ollama.com for direct cloud access.",
            ),
            CredentialField(
                name="api_key",
                label="API Key",
                required=False,
                placeholder="ollama_...",
                help_text="Required for direct Ollama Cloud API access. Leave blank for local-only usage.",
            ),
        ],
        recommended_models=[
            ModelDescriptor(id="llama3.1", label="llama3.1", recommended=True),
            ModelDescriptor(id="qwen3", label="qwen3", recommended=True),
            ModelDescriptor(id="mistral-small3.1", label="mistral-small3.1"),
            ModelDescriptor(id="gpt-oss:20b", label="gpt-oss:20b"),
            ModelDescriptor(id="gpt-oss:120b", label="gpt-oss:120b"),
            ModelDescriptor(id="qwen3-coder:480b", label="qwen3-coder:480b"),
        ],
        default_model="llama3.1",
        docs_url="https://docs.ollama.com/cloud",
    ),
}

PROVIDERS = {
    "openai": OpenAIAdapter(PROVIDER_SPECS["openai"]),
    "gemini": GeminiAdapter(PROVIDER_SPECS["gemini"]),
    "groq": GroqAdapter(PROVIDER_SPECS["groq"]),
    "anthropic": AnthropicAdapter(PROVIDER_SPECS["anthropic"]),
    "ollama": OllamaAdapter(PROVIDER_SPECS["ollama"]),
}


def get_provider_adapter(provider: str):
    if provider not in PROVIDERS:
        raise ValueError(f"Unsupported provider: {provider}")
    return PROVIDERS[provider]


def get_provider_spec(provider: str) -> ProviderSpec:
    if provider not in PROVIDER_SPECS:
        raise ValueError(f"Unsupported provider: {provider}")
    return PROVIDER_SPECS[provider]


def get_provider_catalog() -> List[dict]:
    catalog = []
    for provider_id, spec in PROVIDER_SPECS.items():
        catalog.append(
            {
                "id": provider_id,
                "name": spec.name,
                "description": spec.description,
                "default_model": spec.default_model,
                "runtime_model_discovery": spec.runtime_model_discovery,
                "docs_url": spec.docs_url,
                "credential_fields": [
                    {
                        "name": field.name,
                        "label": field.label,
                        "required": field.required,
                        "secret": field.secret,
                        "input_type": field.input_type,
                        "placeholder": field.placeholder,
                        "help_text": field.help_text,
                    }
                    for field in spec.credential_fields
                ],
                "recommended_models": [
                    {
                        "id": model.id,
                        "label": model.label,
                        "recommended": model.recommended,
                        "source": model.source,
                    }
                    for model in spec.recommended_models
                ],
            }
        )
    return catalog
