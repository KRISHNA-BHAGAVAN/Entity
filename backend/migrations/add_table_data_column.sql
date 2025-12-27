-- Migration: Add table_data column to templates table
-- Run this SQL in your Supabase SQL editor

ALTER TABLE templates 
ADD COLUMN table_data JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN templates.table_data IS 'Extracted table data from DOCX files stored as JSON array';

-- Optional: Create an index on table_data for better query performance
CREATE INDEX idx_templates_table_data ON templates USING GIN (table_data);