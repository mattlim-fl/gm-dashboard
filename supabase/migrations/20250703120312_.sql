-- Phase 1: Database Cleanup - Drop unnecessary tables and simplify schema

-- Drop foreign key constraints first
ALTER TABLE revenue_events DROP CONSTRAINT IF EXISTS revenue_events_square_payment_id_fkey;

-- Drop unnecessary tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS square_locations_raw CASCADE;
DROP TABLE IF EXISTS square_orders_raw CASCADE;
DROP TABLE IF EXISTS square_team_members_raw CASCADE;
DROP TABLE IF EXISTS square_backfill_sessions CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;

-- Simplify square_payments_raw table
ALTER TABLE square_payments_raw 
  DROP COLUMN IF EXISTS api_version,
  DROP COLUMN IF EXISTS created_at;

-- Rename sync_timestamp to synced_at
ALTER TABLE square_payments_raw 
  RENAME COLUMN sync_timestamp TO synced_at;

-- Ensure revenue_events has all needed columns (already exists correctly)
-- Add foreign key back to square_payments_raw
ALTER TABLE revenue_events 
  ADD CONSTRAINT revenue_events_square_payment_id_fkey 
  FOREIGN KEY (square_payment_id) 
  REFERENCES square_payments_raw(square_payment_id);

-- Update any indexes
DROP INDEX IF EXISTS idx_square_payments_raw_sync_timestamp;
CREATE INDEX idx_square_payments_raw_synced_at ON square_payments_raw(synced_at);;
