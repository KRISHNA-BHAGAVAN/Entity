-- Entity schema v1
-- Idempotent schema bootstrap for user-owned Supabase projects.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
    CREATE TYPE public.llm_provider AS ENUM ('openai', 'gemini', 'groq', 'anthropic', 'ollama');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_key_status') THEN
    CREATE TYPE public.llm_key_status AS ENUM ('active', 'revoked', 'rotated');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_data jsonb DEFAULT '[]'::jsonb,
  upload_date timestamptz DEFAULT now(),
  drive_file_id text,
  drive_preview_url text,
  preview_status text DEFAULT 'pending'::text
);

CREATE TABLE IF NOT EXISTS public.llm_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.llm_provider NOT NULL,
  model text,
  encrypted_key text,
  encrypted_credentials text,
  key_fingerprint text,
  status public.llm_key_status NOT NULL DEFAULT 'active',
  last_validated_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.llm_key_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.llm_provider,
  model text,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  root_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version integer PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT TRUE,
  error_message text
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_default_report_columns()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_llm_api_keys_updated_at ON public.llm_api_keys;
CREATE TRIGGER trg_update_llm_api_keys_updated_at
BEFORE UPDATE ON public.llm_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_drive_connections_updated_at ON public.drive_connections;
CREATE TRIGGER trg_update_drive_connections_updated_at
BEFORE UPDATE ON public.drive_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_key_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_owner_select ON public.events;
CREATE POLICY events_owner_select ON public.events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS events_owner_insert ON public.events;
CREATE POLICY events_owner_insert ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS events_owner_update ON public.events;
CREATE POLICY events_owner_update ON public.events FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS events_owner_delete ON public.events;
CREATE POLICY events_owner_delete ON public.events FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS templates_owner_select ON public.templates;
CREATE POLICY templates_owner_select ON public.templates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS templates_owner_insert ON public.templates;
CREATE POLICY templates_owner_insert ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS templates_owner_update ON public.templates;
CREATE POLICY templates_owner_update ON public.templates FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS templates_owner_delete ON public.templates;
CREATE POLICY templates_owner_delete ON public.templates FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS llm_api_keys_owner_all ON public.llm_api_keys;
CREATE POLICY llm_api_keys_owner_all ON public.llm_api_keys FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS llm_audit_owner_select ON public.llm_key_audit_logs;
CREATE POLICY llm_audit_owner_select ON public.llm_key_audit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS llm_audit_owner_insert ON public.llm_key_audit_logs;
CREATE POLICY llm_audit_owner_insert ON public.llm_key_audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS report_columns_owner_all ON public.report_columns;
CREATE POLICY report_columns_owner_all ON public.report_columns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS drive_connections_owner_all ON public.drive_connections;
CREATE POLICY drive_connections_owner_all ON public.drive_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profiles_owner_select ON public.profiles;
CREATE POLICY profiles_owner_select ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_owner_insert ON public.profiles;
CREATE POLICY profiles_owner_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_schema ON public.events USING GIN (event_schema);

CREATE INDEX IF NOT EXISTS idx_templates_event_id ON public.templates(event_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_upload_date ON public.templates(upload_date);

CREATE INDEX IF NOT EXISTS idx_llm_api_keys_user_provider ON public.llm_api_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_llm_key_audit_logs_user_created_at ON public.llm_key_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_columns_user_order ON public.report_columns(user_id, "order");

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'documents_owner_rw'
  ) THEN
    CREATE POLICY documents_owner_rw
    ON storage.objects
    FOR ALL
    USING (bucket_id = 'documents' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());
  END IF;
END
$$;
