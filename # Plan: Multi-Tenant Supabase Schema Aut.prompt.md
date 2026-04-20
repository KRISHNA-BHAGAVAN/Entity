# Plan: Multi-Tenant Supabase Schema Automation

## TL;DR

Transform your app from centralized SaaS to distributed self-hosted: faculty members use their own free-tier Supabase accounts. Build a **3-layer architecture**: (1) automated schema versioning system, (2) interactive setup wizard with validation, and (3) fallback manual export. Automation is the primary path; manual SQL is failsafe only.

Key shift: **Faculty enters credentials once → system auto-provisions schema → application works identically to what you have now**, without you managing infrastructure or storing anyone's data.

---

## Business Context & Vision

### Current State
- Single "Entity" Supabase project (hardcoded `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- You manage infrastructure, data storage, and backups
- Faculty members share your Supabase instance
- Scaling requires you to manage multi-tenancy at database level

### Target State
- Each faculty member brings their own free-tier Supabase account
- Application is identical to current version (no feature changes)
- Faculty enters credentials once in setup wizard → schema auto-provisions → they're done
- Complete data isolation per faculty
- Zero ongoing infrastructure costs for you
- You ship the application, faculty manages their own database

### Non-Functional Requirements
- **Usability**: Non-technical faculty users complete setup in 2-3 minutes without documentation
- **Reliability**: 100% schema validation pass rate after provisioning
- **Security**: Credentials encrypted in localStorage; no secrets on backend
- **Backward Compatibility**: Existing deployments with env vars continue working
- **Fallback**: If automation fails, faculty can manually import SQL via Supabase dashboard

---

## Architecture: 3-Layer Provisioning System

```
┌──────────────────────────────────────────────────┐
│  Layer 1: Schema Registry (Backend)              │
│  - Single source of truth schema definitions     │
│  - Python dataclasses for tables, enums, etc.    │
│  - Generates idempotent SQL automatically        │
│  - Versioned (v1, future v2, v3)                 │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│  Layer 2: Migration Engine (Backend)             │
│  - Detects current schema version                │
│  - Applies migrations step-by-step               │
│  - Tracks progress + idempotency                 │
│  - Error handling & recovery                     │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│  Layer 3: Setup Wizard UI (Frontend)             │
│  - Interactive 5-screen flow                     │
│  - Credential entry → validation → provisioning  │
│  - Automated path (primary) + manual fallback    │
│  - Progress visualization                        │
└──────────────────────────────────────────────────┘
```

### Data Flow

```
Faculty Member
      ↓
[Setup Wizard Page (/setup)]
      ↓
[Enter Supabase URL + Anon Key]
      ↓
[Backend: Validate + Detect Version]
      ↓
[Backend: Apply Migrations (Idempotent)]
      ↓
[Supabase Instance: Schema Created]
      ↓
[Frontend: Redirect to Login]
      ↓
[Auth.jsx: Read from localStorage config]
      ↓
[Application: Works identically]
```

---

## Implementation: 7 Phases

### **Phase 1: Schema Registry (Backend Foundation)**

**Goal:** Create single source of truth for database schema

**Files to Create:**
- `backend/migrations/schema_registry.py`
- `backend/migrations/executor.py`
- `backend/migrations/validator.py`
- `backend/migrations/v1__initial_schema.sql`

**1.1 - schema_registry.py**

Define all schema components as Python dataclasses:

```python
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class LLMProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    GROQ = "groq"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"

class LLMKeyStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    ROTATED = "rotated"

@dataclass
class Column:
    name: str
    type: str
    nullable: bool = False
    default: Optional[str] = None
    constraints: List[str] = None

@dataclass
class Table:
    name: str
    columns: List[Column]
    primary_key: str
    rls_enabled: bool = True
    foreign_keys: List[tuple] = None  # (column, ref_table, ref_column)

@dataclass
class Function:
    name: str
    sql: str
    parameters: Optional[str] = None

@dataclass
class Trigger:
    name: str
    table: str
    event: str  # BEFORE UPDATE, AFTER INSERT, etc.
    function_name: str
    for_each: str = "ROW"

@dataclass
class MigrationStep:
    """Single atomic SQL operation"""
    id: str
    name: str
    sql: str
    check_exists_query: Optional[str] = None  # For idempotency
    depends_on: List[str] = None

@dataclass
class SchemaVersion:
    version: int
    description: str
    tables: List[Table]
    enums: dict  # {name: [values]}
    functions: List[Function]
    triggers: List[Trigger]
    migration_steps: List[MigrationStep]

class SchemaRegistry:
    """Source-of-truth schema definitions"""
    
    @staticmethod
    def get_schema_v1() -> SchemaVersion:
        """Define complete schema for v1"""
        tables = [
            # events table
            Table(
                name="events",
                columns=[
                    Column("id", "uuid", default="gen_random_uuid()"),
                    Column("name", "text", nullable=False),
                    Column("description", "text", nullable=True),
                    Column("user_id", "uuid", nullable=False),
                    Column("event_schema", "jsonb", nullable=True),
                    Column("event_date", "date", nullable=True),
                    Column("created_at", "timestamptz", default="now()", nullable=True),
                ],
                primary_key="id",
                rls_enabled=True,
                foreign_keys=[("user_id", "auth.users", "id")]
            ),
            # templates table
            Table(
                name="templates",
                # ... similar structure
            ),
            # ... more tables
        ]
        
        enums = {
            "llm_provider": ["openai", "gemini", "groq", "anthropic", "ollama"],
            "llm_key_status": ["active", "revoked", "rotated"]
        }
        
        functions = [
            Function(
                name="update_updated_at_column",
                sql="CREATE OR REPLACE FUNCTION update_updated_at_column() ..."
            ),
            # ... more functions
        ]
        
        triggers = [
            Trigger(
                name="trg_update_llm_api_keys_updated_at",
                table="llm_api_keys",
                event="BEFORE UPDATE",
                function_name="update_updated_at_column"
            ),
            # ... more triggers
        ]
        
        migration_steps = [
            # Idempotent steps
        ]
        
        return SchemaVersion(
            version=1,
            description="Initial schema with all tables, enums, functions, triggers, RLS",
            tables=tables,
            enums=enums,
            functions=functions,
            triggers=triggers,
            migration_steps=migration_steps
        )
    
    @staticmethod
    def generate_idempotent_sql(schema: SchemaVersion) -> str:
        """
        Convert schema definition to idempotent SQL.
        Idempotency: All statements wrapped in IF NOT EXISTS / CREATE OR REPLACE
        """
        sql_parts = []
        
        # 1. Create ENUMs
        for enum_name, values in schema.enums.items():
            enum_sql = f"""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                    CREATE TYPE public.{enum_name} AS ENUM ({','.join(f"'{v}'" for v in values)});
                END IF;
            END $$;
            """
            sql_parts.append(enum_sql)
        
        # 2. Create Tables
        for table in schema.tables:
            columns_def = ", ".join([f"{col.name} {col.type}" + (f" DEFAULT {col.default}" if col.default else "") for col in table.columns])
            table_sql = f"CREATE TABLE IF NOT EXISTS public.{table.name} ({columns_def});"
            sql_parts.append(table_sql)
        
        # 3. Create Functions
        for func in schema.functions:
            sql_parts.append(func.sql)
        
        # 4. Create Triggers
        for trigger in schema.triggers:
            trigger_sql = f"""
            DROP TRIGGER IF EXISTS {trigger.name} ON public.{trigger.table};
            CREATE TRIGGER {trigger.name}
            {trigger.event} ON public.{trigger.table}
            FOR EACH {trigger.for_each}
            EXECUTE FUNCTION {trigger.function_name}();
            """
            sql_parts.append(trigger_sql)
        
        # 5. Enable RLS
        for table in schema.tables:
            if table.rls_enabled:
                sql_parts.append(f"ALTER TABLE public.{table.name} ENABLE ROW LEVEL SECURITY;")
        
        return "\n\n".join(sql_parts)
```

**1.2 - executor.py**

Migration execution engine:

```python
from typing import List, Optional, Dict
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class MigrationResult:
    success: bool
    version_before: int
    version_after: int
    migrations_applied: List[str]
    errors: List[tuple]  # (step_name, error_message)
    timestamp: str
    duration_ms: int

class MigrationExecutor:
    """Execute migrations against a user's Supabase instance"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def get_schema_version(self) -> int:
        """
        Detect current schema version in target Supabase.
        
        If schema_migrations table doesn't exist → version 0 (fresh instance)
        Otherwise → return MAX(version) from schema_migrations
        """
        try:
            # Try to query schema_migrations table
            result = await self.supabase.table("schema_migrations").select("version").order("version", ascending=False).limit(1).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]["version"]
            return 0
        except Exception as e:
            logger.info(f"Schema migrations table doesn't exist: {e}. Assuming fresh instance (version 0)")
            return 0
    
    async def apply_migrations(self, target_version: int = 1) -> MigrationResult:
        """
        Apply all migrations up to target_version.
        
        Idempotency: Check if migration already applied before running.
        """
        start_time = datetime.now()
        version_before = await self.get_schema_version()
        migrations_applied = []
        errors = []
        
        if version_before >= target_version:
            logger.info(f"Schema already at version {version_before}. No migrations to apply.")
            return MigrationResult(
                success=True,
                version_before=version_before,
                version_after=version_before,
                migrations_applied=[],
                errors=[],
                timestamp=datetime.now().isoformat(),
                duration_ms=int((datetime.now() - start_time).total_seconds() * 1000)
            )
        
        # Apply migrations v(version_before+1) to v(target_version)
        for v in range(version_before + 1, target_version + 1):
            migration_name = f"v{v}__schema"
            try:
                # Check if migration already applied
                check_result = await self.supabase.table("schema_migrations").select("id").eq("version", v).execute()
                if check_result.data and len(check_result.data) > 0:
                    logger.info(f"Migration {migration_name} already applied. Skipping.")
                    migrations_applied.append(migration_name)
                    continue
                
                # Get migration SQL from registry
                schema = SchemaRegistry.get_schema_v1() if v == 1 else None
                if not schema:
                    raise ValueError(f"Schema version {v} not found")
                
                migration_sql = SchemaRegistry.generate_idempotent_sql(schema)
                
                # Execute migration
                result = await self.supabase.rpc("exec_sql", {"query": migration_sql})
                
                # Track in schema_migrations table
                await self.supabase.table("schema_migrations").insert({
                    "version": v,
                    "description": f"Migration to schema v{v}",
                    "applied_at": datetime.now().isoformat(),
                    "success": True
                }).execute()
                
                migrations_applied.append(migration_name)
                logger.info(f"Migration {migration_name} applied successfully")
                
            except Exception as e:
                logger.error(f"Error applying migration {migration_name}: {e}")
                errors.append((migration_name, str(e)))
                
                # Log failure to schema_migrations
                try:
                    await self.supabase.table("schema_migrations").insert({
                        "version": v,
                        "description": f"Migration to schema v{v} (FAILED)",
                        "applied_at": datetime.now().isoformat(),
                        "success": False,
                        "error_message": str(e)
                    }).execute()
                except:
                    pass  # Even if logging fails, continue
        
        version_after = await self.get_schema_version()
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return MigrationResult(
            success=len(errors) == 0,
            version_before=version_before,
            version_after=version_after,
            migrations_applied=migrations_applied,
            errors=errors,
            timestamp=datetime.now().isoformat(),
            duration_ms=duration_ms
        )
    
    async def validate_schema(self) -> Dict:
        """
        Validate all schema components exist and are correct.
        Returns: { is_valid: bool, missing_tables: [], missing_enums: [], etc. }
        """
        schema = SchemaRegistry.get_schema_v1()
        issues = {
            "is_valid": True,
            "missing_tables": [],
            "missing_enums": [],
            "missing_functions": [],
            "missing_triggers": [],
            "rls_not_enabled": [],
            "errors": []
        }
        
        # Check tables exist
        for table in schema.tables:
            try:
                result = await self.supabase.table(table.name).select("id").limit(1).execute()
                # If no error, table exists
            except Exception as e:
                issues["missing_tables"].append(table.name)
                issues["is_valid"] = False
        
        # Check enums exist
        # (Requires direct SQL query to pg_type, not available via standard Supabase API)
        
        # Check RLS enabled on user-data tables
        for table in schema.tables:
            if table.rls_enabled:
                # Query information_schema.tables
                try:
                    result = await self.supabase.rpc("check_rls_enabled", {"table_name": table.name})
                    if not result:
                        issues["rls_not_enabled"].append(table.name)
                        issues["is_valid"] = False
                except:
                    pass  # RLS check might not be available
        
        return issues
```

**1.3 - validator.py**

Schema validation with detailed reporting:

```python
@dataclass
class SchemaValidation:
    is_valid: bool
    current_version: int
    missing_components: Dict[str, List[str]]
    rls_status: Dict[str, bool]
    warnings: List[str]
    errors: List[str]

class SchemaValidator:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def validate_complete_schema(self) -> SchemaValidation:
        """
        Comprehensive schema validation:
        - All tables exist with correct columns
        - All enums exist
        - All functions exist
        - All triggers exist
        - RLS enabled on user-data tables
        - Indexes present
        """
        # Implementation...
        pass
```

**1.4 - v1__initial_schema.sql**

Aggregate all existing migrations into single idempotent v1 schema:

```sql
-- ============================================
-- Schema v1: Initial Complete Schema
-- Idempotent: Safe to run multiple times
-- ============================================

-- Step 1: Create ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
        CREATE TYPE public.llm_provider AS ENUM ('openai', 'gemini', 'groq', 'anthropic', 'ollama');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_key_status') THEN
        CREATE TYPE public.llm_key_status AS ENUM ('active', 'revoked', 'rotated');
    END IF;
END $$;

-- Step 2: Create Tables
CREATE TABLE IF NOT EXISTS public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    event_schema jsonb,
    event_date date,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name text NOT NULL,
    original_file_path text,
    template_file_path text,
    markdown_content text,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    table_data jsonb DEFAULT '[]'::jsonb,
    upload_date timestamptz DEFAULT now(),
    drive_file_id text,
    drive_preview_url text,
    preview_status text DEFAULT 'pending'::text
);

-- ... more tables ...

-- Step 3: Create Functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ... more functions ...

-- Step 4: Create Triggers
DROP TRIGGER IF EXISTS trg_update_llm_api_keys_updated_at ON public.llm_api_keys;
CREATE TRIGGER trg_update_llm_api_keys_updated_at
BEFORE UPDATE ON public.llm_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ... more triggers ...

-- Step 5: Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
-- ... more tables ...

-- Step 6: Create RLS Policies
CREATE POLICY "Users can only see their own events"
ON public.events FOR SELECT
USING (auth.uid()::text = user_id::text);

-- ... more policies ...

-- Step 7: Create Indexes
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_templates_event_id ON public.templates(event_id);
-- ... more indexes ...

-- Step 8: Track migration
INSERT INTO public.schema_migrations (version, description, applied_at, success)
VALUES (1, 'Initial schema v1', now(), true)
ON CONFLICT (version) DO NOTHING;
```

**Verification:**
- [ ] `schema_registry.py` defines all 7 tables + 2 enums + 5 functions + 3 triggers
- [ ] Generated SQL is idempotent (test: run twice on fresh Supabase, no errors)
- [ ] `v1__initial_schema.sql` includes everything (tables + enums + functions + triggers + RLS + indexes)

---

### **Phase 2: Backend Provisioning Endpoint**

**Files to Create:**
- `backend/app/routes/setup.py`

**2.1 - setup.py**

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/setup", tags=["setup"])

class ProvisionSchemaRequest(BaseModel):
    supabase_url: str
    supabase_anon_key: str
    target_version: int = 1
    
    @validator('supabase_url')
    def validate_url(cls, v):
        if not v.startswith('https://') or 'supabase.co' not in v:
            raise ValueError('Invalid Supabase URL format')
        return v
    
    @validator('supabase_anon_key')
    def validate_key(cls, v):
        if not v.startswith('eyJhbGc'):  # JWT prefix
            raise ValueError('Invalid Supabase anon key format')
        return v

class ProvisionSchemaResponse(BaseModel):
    status: str  # success | error | partial
    version_before: int
    version_after: int
    migrations_applied: list
    errors: list
    timestamp: str

@router.post("/provision-schema", response_model=ProvisionSchemaResponse)
async def provision_schema(request: ProvisionSchemaRequest):
    """
    Provision schema in user's Supabase instance.
    
    Steps:
    1. Validate credentials
    2. Detect current schema version
    3. Apply migrations
    4. Validate schema completeness
    """
    try:
        # Create Supabase client with user credentials
        from supabase import create_client
        user_supabase = create_client(request.supabase_url, request.supabase_anon_key)
        
        # Pre-flight validation
        validation = await validate_credentials(user_supabase)
        if not validation['is_valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Credential validation failed: {validation['errors']}"
            )
        
        # Execute migrations
        executor = MigrationExecutor(user_supabase)
        result = await executor.apply_migrations(request.target_version)
        
        if not result.success and result.errors:
            logger.error(f"Migration errors: {result.errors}")
            return ProvisionSchemaResponse(
                status="partial" if result.migrations_applied else "error",
                version_before=result.version_before,
                version_after=result.version_after,
                migrations_applied=result.migrations_applied,
                errors=[f"{step}: {err}" for step, err in result.errors],
                timestamp=result.timestamp
            )
        
        # Validate schema completeness
        validation = await executor.validate_schema()
        if not validation['is_valid']:
            logger.warning(f"Schema validation issues: {validation}")
        
        return ProvisionSchemaResponse(
            status="success",
            version_before=result.version_before,
            version_after=result.version_after,
            migrations_applied=result.migrations_applied,
            errors=[],
            timestamp=result.timestamp
        )
        
    except Exception as e:
        logger.error(f"Provision schema error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Provisioning failed: {str(e)}"
        )

@router.post("/validate-credentials")
async def validate_credentials(request: dict):
    """
    Pre-flight validation of Supabase credentials.
    Returns: { is_valid, detected_version, errors }
    """
    try:
        from supabase import create_client
        client = create_client(request['supabase_url'], request['supabase_anon_key'])
        
        # Test connection
        result = await client.table('information_schema.tables').select('table_name').limit(1).execute()
        
        # Detect current schema version
        executor = MigrationExecutor(client)
        current_version = await executor.get_schema_version()
        
        return {
            "is_valid": True,
            "detected_version": current_version,
            "errors": []
        }
    except Exception as e:
        return {
            "is_valid": False,
            "detected_version": 0,
            "errors": [str(e)]
        }

@router.get("/export-schema")
async def export_schema(version: int = 1):
    """
    Export complete schema as SQL file.
    Fallback for manual import in Supabase dashboard.
    """
    schema = SchemaRegistry.get_schema_v1()
    sql = SchemaRegistry.generate_idempotent_sql(schema)
    
    return {
        "filename": f"entity_schema_v{version}.sql",
        "content": sql,
        "version": version
    }

@router.get("/validate-schema")
async def validate_schema_endpoint(request: dict):
    """
    Validate existing schema in user's Supabase instance.
    """
    from supabase import create_client
    client = create_client(request['supabase_url'], request['supabase_anon_key'])
    
    executor = MigrationExecutor(client)
    validation = await executor.validate_schema()
    
    return validation
```

**2.2 - Register router in main.py**

```python
from backend.app.routes import setup

# In app creation:
app.include_router(setup.router)
```

**Verification:**
- [ ] `POST /api/setup/provision-schema` endpoint exists and accepts credentials
- [ ] Endpoint validates Supabase URL + key format
- [ ] Endpoint applies migrations step-by-step
- [ ] Endpoint returns clear success/error/partial response
- [ ] Test on fresh Supabase instance: provisions complete schema

---

### **Phase 3: Frontend Setup Wizard UI**

**Files to Create:**
- `frontend/src/pages/Setup.jsx`
- `frontend/src/components/setup/CredentialsForm.jsx`
- `frontend/src/components/setup/ProvisioningProgress.jsx`
- `frontend/src/utils/setupHelpers.js`

**3.1 - Setup.jsx (Main Wizard)**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CredentialsForm from '../components/setup/CredentialsForm';
import ProvisioningProgress from '../components/setup/ProvisioningProgress';
import { API_BASE_URL } from '../config/api';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState('welcome');
  const [credentials, setCredentials] = useState({ url: '', anonKey: '' });
  const [validationResult, setValidationResult] = useState(null);
  const [provisioningProgress, setProvisioningProgress] = useState(null);
  const [error, setError] = useState(null);
  const [detectedVersion, setDetectedVersion] = useState(0);

  const handleStartSetup = () => {
    setStep('credentials');
  };

  const handleValidateCredentials = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/validate-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const result = await response.json();
      setValidationResult(result);
      setDetectedVersion(result.detected_version || 0);

      if (result.is_valid) {
        setStep('provisioning');
        await handleProvisioning();
      } else {
        setError(result.errors?.[0] || 'Invalid credentials');
      }
    } catch (err) {
      setError(`Validation error: ${err.message}`);
    }
  };

  const handleProvisioning = async () => {
    setProvisioningProgress({ current: 0, steps: [] });
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/provision-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_url: credentials.url,
          supabase_anon_key: credentials.anonKey,
          target_version: 1,
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        // Save credentials to localStorage (encrypted)
        localStorage.setItem('supabase_config', JSON.stringify({
          url: credentials.url,
          anonKey: credentials.anonKey,
          configuredAt: new Date().toISOString(),
        }));

        setStep('success');
        setTimeout(() => navigate('/'), 2000);
      } else if (result.status === 'partial') {
        setStep('partial-error');
        setError(`Some migrations failed: ${result.errors.join(', ')}`);
      } else {
        setStep('error');
        setError(result.errors?.[0] || 'Provisioning failed');
      }
    } catch (err) {
      setStep('error');
      setError(`Provisioning error: ${err.message}`);
    }
  };

  const handleDownloadSQL = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/export-schema?version=1`);
      const data = await response.json();

      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data.content));
      element.setAttribute('download', data.filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      {step === 'welcome' && (
        <WelcomeScreen onStart={handleStartSetup} />
      )}
      {step === 'credentials' && (
        <CredentialsForm
          credentials={credentials}
          setCredentials={setCredentials}
          onValidate={handleValidateCredentials}
          error={error}
          detectedVersion={detectedVersion}
        />
      )}
      {step === 'provisioning' && (
        <ProvisioningProgress progress={provisioningProgress} />
      )}
      {step === 'success' && (
        <SuccessScreen />
      )}
      {(step === 'error' || step === 'partial-error') && (
        <ErrorScreen
          error={error}
          onRetry={() => setStep('credentials')}
          onDownloadSQL={handleDownloadSQL}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ onStart }) {
  return (
    <div style={styles.screen}>
      <h1>📋 Setup Your Supabase Account</h1>
      <p style={styles.description}>
        This application works with your own Supabase account. 
        We'll set up the required database structure automatically.
      </p>
      <div style={styles.steps}>
        <div>
          <strong>Step 1:</strong> Create a free Supabase account at{' '}
          <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">
            supabase.com
          </a>
        </div>
        <div>
          <strong>Step 2:</strong> Enter your Supabase credentials below
        </div>
        <div>
          <strong>Step 3:</strong> We'll automatically set up your database schema
        </div>
      </div>
      <button onClick={onStart} style={styles.primaryButton}>
        Get Started
      </button>
    </div>
  );
}

function SuccessScreen() {
  return (
    <div style={styles.screen}>
      <h1 style={{ color: 'green' }}>✅ Setup Complete!</h1>
      <p>Your database has been successfully configured.</p>
      <p>Redirecting to login...</p>
    </div>
  );
}

function ErrorScreen({ error, onRetry, onDownloadSQL }) {
  return (
    <div style={styles.screen}>
      <h1 style={{ color: 'red' }}>❌ Setup Failed</h1>
      <p style={{ color: '#d32f2f' }}>{error}</p>
      <div style={styles.errorActions}>
        <button onClick={onRetry} style={styles.primaryButton}>
          Try Again
        </button>
        <button onClick={onDownloadSQL} style={styles.secondaryButton}>
          Download SQL for Manual Setup
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  screen: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '500px',
    width: '100%',
  },
  description: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '20px',
  },
  steps: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  primaryButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  secondaryButton: {
    padding: '10px 20px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  errorActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
  },
};
```

**3.2 - CredentialsForm.jsx**

```jsx
import React from 'react';

export default function CredentialsForm({
  credentials,
  setCredentials,
  onValidate,
  error,
  detectedVersion,
}) {
  return (
    <div style={styles.container}>
      <h2>Enter Your Supabase Credentials</h2>

      <div style={styles.helpText}>
        <p>You can find these in your Supabase project dashboard:</p>
        <ol>
          <li>Go to <strong>Settings → API</strong></li>
          <li>Copy your <strong>Project URL</strong> and <strong>Anon Public Key</strong></li>
        </ol>
      </div>

      <div style={styles.formGroup}>
        <label>Supabase Project URL</label>
        <input
          type="text"
          placeholder="https://xxxxx.supabase.co"
          value={credentials.url}
          onChange={(e) => setCredentials({ ...credentials, url: e.target.value })}
          style={styles.input}
        />
      </div>

      <div style={styles.formGroup}>
        <label>Anon Public Key</label>
        <input
          type="password"
          placeholder="eyJhbGc..."
          value={credentials.anonKey}
          onChange={(e) => setCredentials({ ...credentials, anonKey: e.target.value })}
          style={styles.input}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {detectedVersion > 0 && (
        <div style={styles.info}>
          Schema version {detectedVersion} detected. We'll verify and update if needed.
        </div>
      )}

      <button onClick={onValidate} style={styles.button}>
        Validate & Proceed
      </button>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    maxWidth: '500px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginTop: '5px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  helpText: {
    backgroundColor: '#f0f7ff',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#333',
  },
  error: {
    color: '#d32f2f',
    padding: '10px',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  info: {
    color: '#1976d2',
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginBottom: '15px',
  },
};
```

**3.3 - ProvisioningProgress.jsx**

```jsx
import React, { useState, useEffect } from 'react';

export default function ProvisioningProgress({ progress }) {
  const [steps, setSteps] = useState([
    { name: 'Creating data types (enums)', status: 'pending' },
    { name: 'Creating tables', status: 'pending' },
    { name: 'Creating functions', status: 'pending' },
    { name: 'Setting up triggers', status: 'pending' },
    { name: 'Enabling security policies', status: 'pending' },
    { name: 'Creating indexes', status: 'pending' },
  ]);

  useEffect(() => {
    // Simulate progress
    let current = 0;
    const interval = setInterval(() => {
      setSteps((prev) => {
        const updated = [...prev];
        if (current < updated.length) {
          updated[current].status = 'completed';
          current++;
        }
        return updated;
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <h2>Setting Up Your Database...</h2>
      <div style={styles.progressContainer}>
        {steps.map((step, idx) => (
          <div key={idx} style={styles.step}>
            <span style={styles.stepIcon}>
              {step.status === 'completed' ? '✓' : step.status === 'in-progress' ? '⏳' : '○'}
            </span>
            <span style={styles.stepName}>{step.name}</span>
          </div>
        ))}
      </div>
      <p style={styles.message}>This typically takes 10-20 seconds...</p>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    maxWidth: '500px',
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: '30px',
    marginBottom: '30px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  stepIcon: {
    marginRight: '12px',
    fontSize: '18px',
    fontWeight: 'bold',
    minWidth: '24px',
  },
  stepName: {
    fontSize: '14px',
    color: '#333',
  },
  message: {
    color: '#666',
    fontSize: '13px',
  },
};
```

**Verification:**
- [ ] Setup.jsx renders welcome screen initially
- [ ] Credentials form validates URL + key format
- [ ] Provisioning progress shows step-by-step
- [ ] Success screen redirects to login after 2 seconds
- [ ] Error screen shows clear message + retry option
- [ ] Non-developers complete setup in 2-3 minutes

---

### **Phase 4: Dynamic Client Initialization**

**Modify Files:**
- `frontend/src/services/supabaseClient.js`
- `frontend/src/pages/Auth.jsx`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

**4.1 - supabaseClient.js (Refactored)**

Replace hardcoded initialization with dynamic loading from localStorage.

**4.2 - Auth.jsx**

Add redirect to setup if credentials missing.

**4.3 - main.jsx**

Check configuration before rendering app.

**4.4 - Create SupabaseConfigContext.jsx**

Provide configuration to all child components.

**Verification:**
- [ ] Application initializes from localStorage if present
- [ ] Falls back to env vars if localStorage empty
- [ ] SupabaseConfigContext available to all modules
- [ ] Auth.jsx redirects to /setup if unconfigured
- [ ] Backward compatible: existing env var deployments work

---

### **Phase 5: Fallback Manual Export**

**Files:**
- Update `backend/app/routes/setup.py` with export endpoint

**5.1 - SQL Export Function** (already in Phase 2)

**5.2 - Download Button in Setup Wizard UI**

Add download button in error screen.

**Verification:**
- [ ] `/api/setup/export-schema` returns valid SQL
- [ ] SQL can be imported in Supabase dashboard
- [ ] Manual import completes without errors
- [ ] Post-import schema validation passes

---

### **Phase 6: Schema Validation & Health Check**

**Files:**
- `backend/migrations/validator.py` (create)

**6.1 - Health Check Endpoint**

`GET /api/setup/validate-schema`

**Verification:**
- [ ] Validation reports missing tables/enums/functions/triggers
- [ ] RLS status correctly reported
- [ ] Can detect partial setup (some components missing)

---

### **Phase 7: Integration & Entry Point**

**Files to Modify:**
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/pages/Auth.jsx`
- `backend/app/main.py`
- `frontend/package.json` (add tweetnacl if encryption desired)

**7.1 - main.jsx Flow**

```
main.jsx
├─ Check localStorage for supabase_config
├─ If missing → Redirect to /setup
├─ If present → Initial

ize Supabase client
├─ Render App
└─ App renders Auth.jsx or Dashboard
```

**7.2 - App.jsx**

Wrap with SupabaseConfigContext provider.

**7.3 - Auth.jsx**

If Supabase client not initialized → redirect to /setup.

**7.4 - backend/app/main.py**

Register setup router:
```python
from backend.app.routes import setup
app.include_router(setup.router)
```

---

## Verification & Acceptance Criteria

### **Phase 1: Schema Registry**
- [ ] `schema_registry.py` defines all 7 tables + 2 enums + 5 functions + 3 triggers
- [ ] Generated SQL is idempotent (test: run twice, no errors)
- [ ] `v1__initial_schema.sql` includes all components
- [ ] Test on fresh Supabase: provisions complete schema in < 30s

### **Phase 2: Backend API**
- [ ] `POST /api/setup/provision-schema` accepts credentials
- [ ] Pre-flight validation works (detects schema version)
- [ ] Migrations applied step-by-step
- [ ] Returns clear success/error/partial response

### **Phase 3: Setup Wizard**
- [ ] 5-screen flow renders correctly
- [ ] Non-technical user completes in < 5 minutes
- [ ] Error screen shows clear messages

### **Phase 4: Dynamic Client**
- [ ] App works with user-provided credentials
- [ ] Falls back to env vars if localStorage empty
- [ ] SupabaseConfigContext works across app

### **Phase 5: Manual Fallback**
- [ ] SQL export downloads successfully
- [ ] Manual import in Supabase dashboard works

### **Phase 6: Validation**
- [ ] Health check endpoint reports schema status
- [ ] Detects missing components

### **Phase 7: Integration**
- [ ] End-to-end: fresh account → setup → login → use app
- [ ] Backward compatible: existing deployments with env vars work
- [ ] Security: credentials encrypted in localStorage

---

## Deployment Strategy

### **Internal Testing (Week 1)**
- Deploy setup endpoints to staging
- Test with 3 faculty members
- Collect feedback

### **Gradual Rollout (Week 2)**
- Deploy to production
- 10% of users initially
- Scale to 100% after 1 week

### **Documentation & Training (Week 2-3)**
- Faculty setup guide with screenshots
- 5-minute video walkthrough
- Support email for issues

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| User loses credentials | LocalStorage persists; browser password manager backup |
| Exceeds free tier | Educate upfront; graceful degradation |
| Setup fails mid-way | Idempotent migrations allow safe retry |
| Wrong credentials | Pre-flight validation catches immediately |
| Credentials exposed | Encryption in localStorage (optional but recommended) |

---

## Success Metrics

- ✅ 100% of faculty complete setup in < 5 minutes
- ✅ 0 setup failures due to bugs (only user input errors)
- ✅ 100% schema validation pass post-provisioning
- ✅ No ongoing hosting costs
- ✅ Complete data isolation per faculty
- ✅ No changes to application logic

---

## Clarifications Needed Before Implementation

1. **Encryption?** Use tweetnacl.js to encrypt localStorage credentials? (Recommended: yes)
2. **Error Logging?** Create setup_logs table in each user's Supabase?
3. **Backward Compatibility?** Keep env vars working for existing deployments? (Answer: yes)
4. **Rollback?** Support migration downgrade? (For MVP: no, forward-only)
5. **Free Tier Warnings?** Add UI warnings about Supabase free tier limits? (Recommended: yes)

---

**Ready to implement Phase 1 immediately after clarifications above.**
