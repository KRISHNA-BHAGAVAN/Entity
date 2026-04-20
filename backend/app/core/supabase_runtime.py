from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class SupabaseRuntimeConfig:
    url: str
    anon_key: str


_runtime_supabase_config: ContextVar[SupabaseRuntimeConfig | None] = ContextVar(
    "runtime_supabase_config",
    default=None,
)


def _validate_supabase_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Invalid Supabase URL")

    hostname = parsed.hostname or ""
    if not hostname.endswith(".supabase.co"):
        raise ValueError("Supabase URL must target a supabase.co project")

    return f"https://{hostname}"


def _validate_anon_key(anon_key: str) -> str:
    value = (anon_key or "").strip()
    if len(value) < 40 or not value.startswith("eyJ"):
        raise ValueError("Invalid Supabase anon key")
    return value


def set_runtime_supabase_config(url: str, anon_key: str):
    normalized = SupabaseRuntimeConfig(
        url=_validate_supabase_url(url),
        anon_key=_validate_anon_key(anon_key),
    )
    return _runtime_supabase_config.set(normalized)


def clear_runtime_supabase_config(token) -> None:
    if token is not None:
        _runtime_supabase_config.reset(token)


def get_runtime_supabase_config() -> SupabaseRuntimeConfig | None:
    return _runtime_supabase_config.get()


def normalize_runtime_supabase_config(url: str, anon_key: str) -> SupabaseRuntimeConfig:
    return SupabaseRuntimeConfig(
        url=_validate_supabase_url(url),
        anon_key=_validate_anon_key(anon_key),
    )
