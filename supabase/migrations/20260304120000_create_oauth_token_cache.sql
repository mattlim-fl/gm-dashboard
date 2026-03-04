-- Migration: Create OAuth token cache table
-- Purpose: Cache short-lived access tokens to prevent race conditions when multiple
-- concurrent requests try to refresh tokens (especially Xero which rotates refresh tokens)

CREATE TABLE IF NOT EXISTS public.oauth_token_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.venue_api_credentials(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,  -- AES-256-GCM encrypted access token
  expires_at timestamptz NOT NULL,        -- When the access token expires
  refresh_lock_until timestamptz,         -- For optimistic locking during refresh
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(credential_id)
);

-- Index for looking up by credential_id (already covered by unique constraint)
CREATE INDEX IF NOT EXISTS idx_oauth_token_cache_expires
  ON public.oauth_token_cache(expires_at);

-- RLS
ALTER TABLE public.oauth_token_cache ENABLE ROW LEVEL SECURITY;

-- Service role has full access (tokens are accessed from backend/edge functions only)
CREATE POLICY "Service role full access oauth_token_cache"
  ON public.oauth_token_cache FOR ALL TO service_role USING (true);

-- No authenticated user access - tokens are handled server-side only
-- (Unlike venue_api_credentials which has limited read access for UI)

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_oauth_token_cache' AND tgrelid = 'public.oauth_token_cache'::regclass) THEN
    CREATE TRIGGER set_updated_at_oauth_token_cache
      BEFORE UPDATE ON public.oauth_token_cache
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END$$;

-- Comments
COMMENT ON TABLE public.oauth_token_cache IS 'Caches short-lived OAuth access tokens to prevent race conditions during concurrent refresh attempts';
COMMENT ON COLUMN public.oauth_token_cache.credential_id IS 'FK to venue_api_credentials - one cache entry per credential';
COMMENT ON COLUMN public.oauth_token_cache.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN public.oauth_token_cache.expires_at IS 'When the access token expires (use 1-minute buffer before expiry)';
COMMENT ON COLUMN public.oauth_token_cache.refresh_lock_until IS 'Optimistic lock - if set and in future, another request is refreshing the token';
