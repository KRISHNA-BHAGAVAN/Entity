from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional

_TRUTHY_VALUES = {"1", "true", "yes", "on"}


def _strip_wrapping_quotes(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
        cleaned = cleaned[1:-1].strip()
    return cleaned or None


def parse_env_bool(value: Optional[str]) -> bool:
    cleaned = _strip_wrapping_quotes(value)
    if cleaned is None:
        return False
    return cleaned.lower() in _TRUTHY_VALUES


@dataclass(frozen=True)
class LangSmithSettings:
    enabled: bool
    api_key: Optional[str]
    project_name: Optional[str]
    workspace_id: Optional[str]
    endpoint: Optional[str]


def build_langsmith_settings(env: Mapping[str, str]) -> LangSmithSettings:
    return LangSmithSettings(
        enabled=parse_env_bool(env.get("LANGSMITH_TRACING")),
        api_key=_strip_wrapping_quotes(env.get("LANGSMITH_API_KEY")),
        project_name=_strip_wrapping_quotes(env.get("LANGSMITH_PROJECT")),
        workspace_id=_strip_wrapping_quotes(env.get("LANGSMITH_WORKSPACE_ID")),
        endpoint=_strip_wrapping_quotes(env.get("LANGSMITH_ENDPOINT")),
    )


def configure_langsmith(env: Optional[Mapping[str, str]] = None) -> LangSmithSettings:
    settings = build_langsmith_settings(env or os.environ)

    os.environ["LANGSMITH_TRACING"] = "true" if settings.enabled else "false"

    if settings.api_key:
        os.environ["LANGSMITH_API_KEY"] = settings.api_key
    if settings.project_name:
        os.environ["LANGSMITH_PROJECT"] = settings.project_name
    if settings.workspace_id:
        os.environ["LANGSMITH_WORKSPACE_ID"] = settings.workspace_id
    if settings.endpoint:
        os.environ["LANGSMITH_ENDPOINT"] = settings.endpoint

    return settings


def install_langsmith_middleware(app, settings: Optional[LangSmithSettings] = None) -> None:
    active_settings = settings or build_langsmith_settings(os.environ)
    if not active_settings.enabled:
        return

    try:
        from langsmith.middleware import TracingMiddleware
    except Exception:
        return

    app.add_middleware(TracingMiddleware)
