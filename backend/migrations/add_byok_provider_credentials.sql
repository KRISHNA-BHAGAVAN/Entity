ALTER TABLE public.llm_api_keys
ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'llm_provider'
    ) THEN
        BEGIN
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'anthropic';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'ollama';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

