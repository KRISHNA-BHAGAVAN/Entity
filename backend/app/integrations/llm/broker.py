from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from app.core.errors import BYOKRequiredError, BYOKSetupRequiredError
from app.integrations.llm.registry import get_provider_adapter, get_provider_spec
from app.integrations.supabase.storage import get_user_supabase_client
from byok_encryption import byok_crypto


class CredentialBroker:
    def list_user_keys(self, jwt_token: str, user_id: str) -> list[dict]:
        supabase = get_user_supabase_client(jwt_token)
        result = (
            supabase.table("llm_api_keys")
            .select("provider, model, status, last_used_at, last_validated_at, created_at")
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []

    def save_key(
        self,
        jwt_token: str,
        user_id: str,
        provider: str,
        model: Optional[str],
        credentials: Dict[str, Any],
    ) -> Tuple[str, dict]:
        adapter = get_provider_adapter(provider)
        validation = adapter.validate_credentials(credentials, model=model)
        validation.raise_for_error()

        supabase = get_user_supabase_client(jwt_token)
        now = datetime.utcnow().isoformat()
        serialized_credentials = json.dumps(credentials)
        encrypted_credentials = byok_crypto.encrypt_api_key(serialized_credentials)
        fingerprint = byok_crypto.fingerprint_api_key(serialized_credentials)
        encrypted_api_key = byok_crypto.encrypt_api_key(credentials["api_key"]) if credentials.get("api_key") else None

        existing = (
            supabase.table("llm_api_keys")
            .select("id")
            .eq("user_id", user_id)
            .eq("provider", provider)
            .execute()
        )

        key_data = {
            "encrypted_credentials": encrypted_credentials,
            "key_fingerprint": fingerprint,
            "model": model,
            "status": "active",
            "last_validated_at": now,
            "updated_at": now,
        }

        if existing.data:
            try:
                supabase.table("llm_api_keys").update(key_data).eq("user_id", user_id).eq("provider", provider).execute()
            except Exception as exc:
                if not self._is_missing_encrypted_credentials_error(exc):
                    raise
                legacy_key_data = self._build_legacy_key_data(
                    credentials=credentials,
                    encrypted_api_key=encrypted_api_key,
                    fingerprint=fingerprint,
                    model=model,
                    now=now,
                )
                supabase.table("llm_api_keys").update(legacy_key_data).eq("user_id", user_id).eq("provider", provider).execute()
            action = "rotated"
        else:
            key_data["user_id"] = user_id
            key_data["provider"] = provider
            try:
                supabase.table("llm_api_keys").insert(key_data).execute()
            except Exception as exc:
                if not self._is_missing_encrypted_credentials_error(exc):
                    raise
                legacy_key_data = self._build_legacy_key_data(
                    credentials=credentials,
                    encrypted_api_key=encrypted_api_key,
                    fingerprint=fingerprint,
                    model=model,
                    now=now,
                )
                legacy_key_data["user_id"] = user_id
                legacy_key_data["provider"] = provider
                supabase.table("llm_api_keys").insert(legacy_key_data).execute()
            action = "created"

        self._log_audit(
            supabase,
            user_id=user_id,
            provider=provider,
            action=action,
            model=model,
            metadata={"credential_fields": sorted(credentials.keys())},
        )
        return action, {"available_models": [model.id for model in validation.available_models]}

    def validate_stored_key(
        self,
        jwt_token: str,
        user_id: str,
        provider: str,
        model: Optional[str] = None,
    ) -> Tuple[bool, str]:
        supabase = get_user_supabase_client(jwt_token)
        record = self._get_record(supabase, user_id=user_id, provider=provider)
        credentials = self._deserialize_credentials(record)
        adapter = get_provider_adapter(provider)
        model_to_test = model or record.get("model")
        validation = adapter.validate_credentials(credentials, model=model_to_test)
        if validation.ok:
            supabase.table("llm_api_keys").update(
                {"last_validated_at": datetime.utcnow().isoformat()}
            ).eq("user_id", user_id).eq("provider", provider).execute()
            self._log_audit(
                supabase,
                user_id=user_id,
                provider=provider,
                action="validated",
                model=model_to_test,
            )
        return validation.ok, validation.message

    def revoke_key(self, jwt_token: str, user_id: str, provider: str) -> None:
        supabase = get_user_supabase_client(jwt_token)
        result = (
            supabase.table("llm_api_keys")
            .update({"status": "revoked", "updated_at": datetime.utcnow().isoformat()})
            .eq("user_id", user_id)
            .eq("provider", provider)
            .execute()
        )
        if not result.data:
            raise ValueError("API key not found")
        self._log_audit(supabase, user_id=user_id, provider=provider, action="revoked")

    def resolve_user_selection(
        self,
        jwt_token: str,
        user_id: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> dict:
        supabase = get_user_supabase_client(jwt_token)
        record = self._get_record(supabase, user_id=user_id, provider=provider, latest=provider is None)
        resolved_provider = record["provider"]
        resolved_model = model or record.get("model") or get_provider_spec(resolved_provider).default_model
        credentials = self._deserialize_credentials(record)
        return {
            "provider": resolved_provider,
            "model": resolved_model,
            "credentials": credentials,
            "record": record,
        }

    def get_llm_for_user(
        self,
        user_id: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        jwt_token: Optional[str] = None,
        strict_byok: bool = True,
        selection: Optional[dict] = None,
        **options,
    ) -> tuple[Any, dict]:
        if not jwt_token:
            if strict_byok:
                raise BYOKRequiredError("BYOK_REQUIRED: Authentication required to resolve provider credentials.")
            raise BYOKSetupRequiredError("BYOK_SETUP_REQUIRED: Authentication required.")

        try:
            resolved_selection = selection or self.resolve_user_selection(
                jwt_token=jwt_token,
                user_id=user_id,
                provider=provider,
                model=model,
            )
        except ValueError as exc:
            if strict_byok:
                raise BYOKRequiredError(f"BYOK_REQUIRED: {exc}") from exc
            raise BYOKSetupRequiredError(f"BYOK_SETUP_REQUIRED: {exc}") from exc

        assert resolved_selection is not None

        adapter = get_provider_adapter(resolved_selection["provider"])
        llm = adapter.create_chat_model(resolved_selection["credentials"], resolved_selection["model"], **options)

        supabase = get_user_supabase_client(jwt_token)
        supabase.table("llm_api_keys").update(
            {"last_used_at": datetime.utcnow().isoformat()}
        ).eq("user_id", user_id).eq("provider", resolved_selection["provider"]).execute()
        self._log_audit(
            supabase,
            user_id=user_id,
            provider=resolved_selection["provider"],
            action="used",
            model=resolved_selection["model"],
        )
        return llm, {
            "key_source": "user",
            "user_key_found": True,
            "fallback_used": False,
            "provider": resolved_selection["provider"],
            "model": resolved_selection["model"],
        }

    def _deserialize_credentials(self, record: dict) -> Dict[str, Any]:
        encrypted_credentials = record.get("encrypted_credentials")
        if encrypted_credentials:
            return json.loads(byok_crypto.decrypt_api_key(encrypted_credentials))

        encrypted_key = record.get("encrypted_key")
        if encrypted_key:
            return {"api_key": byok_crypto.decrypt_api_key(encrypted_key)}

        raise ValueError("Stored credentials are missing")

    def _get_record(
        self,
        supabase,
        user_id: str,
        provider: Optional[str] = None,
        latest: bool = False,
    ) -> dict:
        try:
            query = self._build_record_query(supabase, user_id=user_id, include_encrypted_credentials=True)
            result = self._execute_record_query(query, provider=provider, latest=latest)
        except Exception as exc:
            if not self._is_missing_encrypted_credentials_error(exc):
                raise
            query = self._build_record_query(supabase, user_id=user_id, include_encrypted_credentials=False)
            result = self._execute_record_query(query, provider=provider, latest=latest)

        if provider:
            if not result.data:
                raise ValueError(f"No API key found for provider '{provider}'. Please add your API key in Settings.")
            return result.data

        if latest:
            if not result.data:
                raise ValueError("No active API key found. Please configure BYOK first.")
            return result.data[0]

        raise ValueError("Provider selection is required")

    def _build_legacy_key_data(
        self,
        *,
        credentials: Dict[str, Any],
        encrypted_api_key: Optional[str],
        fingerprint: str,
        model: Optional[str],
        now: str,
    ) -> dict:
        if set(credentials.keys()) != {"api_key"} or not encrypted_api_key:
            raise RuntimeError(
                "Database migration required for BYOK provider credentials. "
                "Run backend/migrations/add_byok_provider_credentials.sql."
            )

        return {
            "encrypted_key": encrypted_api_key,
            "key_fingerprint": fingerprint,
            "model": model,
            "status": "active",
            "last_validated_at": now,
            "updated_at": now,
        }

    def _build_record_query(self, supabase, *, user_id: str, include_encrypted_credentials: bool):
        columns = "provider, model, encrypted_key, status, last_used_at, created_at"
        if include_encrypted_credentials:
            columns = "provider, model, encrypted_credentials, encrypted_key, status, last_used_at, created_at"
        return supabase.table("llm_api_keys").select(columns).eq("user_id", user_id).eq("status", "active")

    def _execute_record_query(self, query, *, provider: Optional[str], latest: bool):
        if provider:
            return query.eq("provider", provider).single().execute()
        if latest:
            return query.order("last_used_at", desc=True).order("created_at", desc=True).limit(1).execute()
        raise ValueError("Provider selection is required")

    def _is_missing_encrypted_credentials_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        if "encrypted_credentials" not in message:
            return False
        return (
            "llm_api_keys" in message
            or "schema cache" in message
            or "column" in message
        )

    def _log_audit(
        self,
        supabase,
        user_id: str,
        provider: str,
        action: str,
        model: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        try:
            supabase.table("llm_key_audit_logs").insert(
                {
                    "user_id": user_id,
                    "provider": provider,
                    "model": model,
                    "action": action,
                    "metadata": metadata or {},
                }
            ).execute()
        except Exception as exc:
            print(f"Failed to log audit: {exc}")


key_broker = CredentialBroker()
