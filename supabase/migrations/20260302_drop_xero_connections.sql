-- Drop legacy xero_connections table
-- This table has been replaced by venue_api_credentials with per-organization scoping
--
-- IMPORTANT: Only run this migration after verifying:
-- 1. All edge functions use getXeroCredentials from _shared/credentials.ts
-- 2. The backend API uses apps/api/src/shared/credentials.ts
-- 3. Xero OAuth flow stores credentials in venue_api_credentials
--
-- The old table structure stored:
-- - access_token (short-lived, refreshed each time)
-- - refresh_token_enc (encrypted)
-- - expires_at (for access token)
-- - tenant_id
--
-- The new venue_api_credentials table stores:
-- - credentials_encrypted: JSON containing { client_id, client_secret, refresh_token, tenant_id }
-- - Scoped by organization_id for Xero (per-org, not per-venue)

-- Drop the table and any associated policies
DROP TABLE IF EXISTS public.xero_connections CASCADE;

-- Also drop the old xero_pnl_snapshots if it references xero_connections
-- (It uses tenant_id directly, not a foreign key, so it should remain)
