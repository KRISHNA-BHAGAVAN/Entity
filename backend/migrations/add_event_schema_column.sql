-- Migration: Add event_schema column to events table
-- Run this SQL in your Supabase SQL editor

ALTER TABLE events 
ADD COLUMN event_schema JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.event_schema IS 'Stored schema data from schema discovery including fields and references';

-- Optional: Create an index on event_schema for better query performance
CREATE INDEX idx_events_event_schema ON events USING GIN (event_schema);