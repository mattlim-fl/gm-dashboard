-- Migration: Add atomic lock acquisition function for OAuth token refresh
-- The Supabase JS client's .update().select() chain doesn't reliably return
-- affected row count, so we use a SQL function with GET DIAGNOSTICS instead.

CREATE OR REPLACE FUNCTION public.acquire_refresh_lock(
  p_credential_id uuid,
  p_lock_until timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Ensure a cache row exists
  INSERT INTO public.oauth_token_cache (credential_id, access_token_encrypted, expires_at, refresh_lock_until)
  VALUES (p_credential_id, '', '1970-01-01T00:00:00Z', NULL)
  ON CONFLICT (credential_id) DO NOTHING;

  -- Atomically acquire lock only if free or expired
  UPDATE public.oauth_token_cache
  SET refresh_lock_until = p_lock_until, updated_at = now()
  WHERE credential_id = p_credential_id
    AND (refresh_lock_until IS NULL OR refresh_lock_until < now());

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION public.acquire_refresh_lock IS 'Atomically acquire a refresh lock for OAuth token rotation. Returns true if lock was acquired.';
