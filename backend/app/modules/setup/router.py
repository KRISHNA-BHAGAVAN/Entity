from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.supabase_runtime import normalize_runtime_supabase_config

setup_router = APIRouter(prefix="/api/setup", tags=["Setup"])

MIGRATION_VERSION = 1
MIGRATION_DESCRIPTION = "Entity schema v1"
MIGRATION_SQL_PATH = Path(__file__).resolve().parents[3] / "migrations" / "v1__initial_schema.sql"


def _extract_project_ref(supabase_url: str) -> str:
    host = urlparse(supabase_url).hostname or ""
    match = re.match(r"^(?P<ref>[a-z0-9-]+)\.supabase\.co$", host)
    if not match:
        raise ValueError("Could not parse project reference from Supabase URL")
    return match.group("ref")


def _build_db_connection_config(
    supabase_url: str,
    db_password: str,
    db_host: Optional[str] = None,
    db_port: int = 5432,
    db_name: str = "postgres",
):
    project_ref = _extract_project_ref(supabase_url)
    host = (db_host or f"db.{project_ref}.supabase.co").strip()
    if not host:
        raise ValueError("Invalid database host")

    return {
        "host": host,
        "port": db_port,
        "dbname": db_name,
        "user": "postgres",
        "password": db_password,
        "sslmode": "require",
        "connect_timeout": 10,
    }


def _load_migration_sql() -> str:
    if not MIGRATION_SQL_PATH.exists():
        raise RuntimeError("Migration SQL file is missing")
    return MIGRATION_SQL_PATH.read_text(encoding="utf-8")


class SetupBaseRequest(BaseModel):
    supabase_url: str = Field(..., description="Project URL, e.g. https://xxxx.supabase.co")
    supabase_anon_key: str = Field(..., description="Supabase anon public key")

    @field_validator("supabase_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        parsed = urlparse((value or "").strip())
        if parsed.scheme != "https" or not parsed.netloc or not (parsed.hostname or "").endswith(".supabase.co"):
            raise ValueError("Supabase URL must be an https://<project-ref>.supabase.co URL")
        return value.strip()

    @field_validator("supabase_anon_key")
    @classmethod
    def validate_anon_key(cls, value: str) -> str:
        normalize_runtime_supabase_config("https://example.supabase.co", value)
        return value.strip()


class ValidateSetupRequest(SetupBaseRequest):
    db_password: Optional[str] = Field(default=None, description="One-time DB password for automation")
    db_host: Optional[str] = None
    db_port: int = 5432
    db_name: str = "postgres"


class ProvisionSetupRequest(ValidateSetupRequest):
    target_version: int = 1


@setup_router.post("/validate")
async def validate_setup(request: ValidateSetupRequest):
    try:
        project_ref = _extract_project_ref(request.supabase_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = {
        "valid": True,
        "project_ref": project_ref,
        "automation_ready": False,
        "schema_version": 0,
        "warnings": [],
    }

    if not request.db_password:
        response["warnings"].append(
            "Automation requires one-time database password from Supabase Settings > Database."
        )
        return response

    try:
        config = _build_db_connection_config(
            supabase_url=request.supabase_url,
            db_password=request.db_password,
            db_host=request.db_host,
            db_port=request.db_port,
            db_name=request.db_name,
        )
        with psycopg2.connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.schema_migrations')")
                if cur.fetchone()[0]:
                    cur.execute("SELECT COALESCE(MAX(version), 0) FROM public.schema_migrations WHERE success = TRUE")
                    response["schema_version"] = int(cur.fetchone()[0] or 0)
        response["automation_ready"] = True
        return response
    except Exception as exc:
        return {
            "valid": False,
            "project_ref": project_ref,
            "automation_ready": False,
            "schema_version": 0,
            "warnings": [],
            "errors": [f"Database connection failed: {exc}"],
        }


@setup_router.post("/provision")
async def provision_setup(request: ProvisionSetupRequest):
    if request.target_version != MIGRATION_VERSION:
        raise HTTPException(status_code=400, detail=f"Unsupported target version: {request.target_version}")

    if not request.db_password:
        raise HTTPException(
            status_code=400,
            detail="Database password is required for automated provisioning.",
        )

    started = time.time()

    try:
        migration_sql = _load_migration_sql()
        config = _build_db_connection_config(
            supabase_url=request.supabase_url,
            db_password=request.db_password,
            db_host=request.db_host,
            db_port=request.db_port,
            db_name=request.db_name,
        )

        with psycopg2.connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.schema_migrations (
                        version integer PRIMARY KEY,
                        description text NOT NULL,
                        applied_at timestamptz NOT NULL DEFAULT now(),
                        success boolean NOT NULL DEFAULT TRUE,
                        error_message text
                    )
                    """
                )

                cur.execute(
                    "SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version = %s AND success = TRUE)",
                    (MIGRATION_VERSION,),
                )
                already_applied = bool(cur.fetchone()[0])

                if not already_applied:
                    cur.execute(migration_sql)
                    cur.execute(
                        """
                        INSERT INTO public.schema_migrations(version, description, success)
                        VALUES (%s, %s, TRUE)
                        ON CONFLICT (version)
                        DO UPDATE SET description = EXCLUDED.description, success = TRUE, error_message = NULL, applied_at = now()
                        """,
                        (MIGRATION_VERSION, MIGRATION_DESCRIPTION),
                    )

                cur.execute("SELECT COALESCE(MAX(version), 0) FROM public.schema_migrations WHERE success = TRUE")
                version_after = int(cur.fetchone()[0] or 0)

        return {
            "status": "success",
            "already_applied": already_applied,
            "target_version": MIGRATION_VERSION,
            "schema_version": version_after,
            "duration_ms": int((time.time() - started) * 1000),
            "manual_fallback_available": True,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Automated provisioning failed: {exc}") from exc


@setup_router.get("/verify")
async def verify_setup(
    supabase_url: str,
    db_password: str,
    db_host: Optional[str] = None,
    db_port: int = 5432,
    db_name: str = "postgres",
):
    required_tables = [
        "events",
        "templates",
        "llm_api_keys",
        "llm_key_audit_logs",
        "report_columns",
        "drive_connections",
        "profiles",
    ]

    try:
        config = _build_db_connection_config(
            supabase_url=supabase_url,
            db_password=db_password,
            db_host=db_host,
            db_port=db_port,
            db_name=db_name,
        )
        missing_tables = []
        with psycopg2.connect(**config) as conn:
            with conn.cursor() as cur:
                for table_name in required_tables:
                    cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
                    if cur.fetchone()[0] is None:
                        missing_tables.append(table_name)

                cur.execute("SELECT to_regclass('public.schema_migrations')")
                if cur.fetchone()[0]:
                    cur.execute("SELECT COALESCE(MAX(version), 0) FROM public.schema_migrations WHERE success = TRUE")
                    version = int(cur.fetchone()[0] or 0)
                else:
                    version = 0

        return {
            "valid": len(missing_tables) == 0,
            "schema_version": version,
            "missing_tables": missing_tables,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Schema verification failed: {exc}") from exc


@setup_router.get("/export-schema")
async def export_schema(version: int = 1):
    if version != MIGRATION_VERSION:
        raise HTTPException(status_code=404, detail="Requested schema version not found")

    return {
        "version": MIGRATION_VERSION,
        "filename": f"entity_schema_v{MIGRATION_VERSION}.sql",
        "content": _load_migration_sql(),
    }
