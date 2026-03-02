-- Migration: Create venue API credentials with flexible scoping
-- Supports per-venue (Square, Gmail), per-organization (Xero), and global (Resend) credentials

-- Organization groupings for venues
CREATE TABLE IF NOT EXISTS public.organizations (
  id text PRIMARY KEY,  -- 'fractal', 'daisies', etc.
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id, name) VALUES
  ('fractal', 'Fractal Hospitality'),
  ('daisies', 'Daisies')
ON CONFLICT (id) DO NOTHING;

-- Map venues to organizations
CREATE TABLE IF NOT EXISTS public.venue_organizations (
  venue text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id)
);

INSERT INTO public.venue_organizations (venue, organization_id) VALUES
  ('manor', 'fractal'),
  ('hippie', 'fractal'),
  ('daisy', 'daisies')
ON CONFLICT (venue) DO NOTHING;

-- API credentials with flexible scoping
CREATE TABLE IF NOT EXISTS public.venue_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scoping: exactly one of these should be set (or both null for global)
  venue text,              -- Per-venue credentials (Square, Gmail)
  organization_id text REFERENCES public.organizations(id),  -- Per-org (Xero)
  -- Integration type
  integration_type text NOT NULL CHECK (integration_type IN (
    'square', 'xero', 'gmail', 'resend'
  )),
  credentials_encrypted text NOT NULL,  -- AES-256-GCM encrypted JSON
  is_active boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  verification_status text CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verification_error text,
  oauth_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Unique index: one credential per scope+type combination (handles NULLs with COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_api_credentials_unique
  ON public.venue_api_credentials(COALESCE(venue, ''), COALESCE(organization_id, ''), integration_type);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_venue_api_credentials_venue ON public.venue_api_credentials(venue) WHERE venue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venue_api_credentials_org ON public.venue_api_credentials(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venue_api_credentials_type ON public.venue_api_credentials(integration_type);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_api_credentials ENABLE ROW LEVEL SECURITY;

-- Organizations: authenticated can read
CREATE POLICY "Authenticated can view organizations"
  ON public.organizations FOR SELECT TO authenticated USING (true);

-- Venue organizations: authenticated can read
CREATE POLICY "Authenticated can view venue_organizations"
  ON public.venue_organizations FOR SELECT TO authenticated USING (true);

-- Credentials: authenticated can view (credentials are encrypted anyway)
CREATE POLICY "Authenticated can view credentials"
  ON public.venue_api_credentials FOR SELECT TO authenticated USING (true);

-- Credentials: authenticated can insert/update (for saving from settings UI)
CREATE POLICY "Authenticated can insert credentials"
  ON public.venue_api_credentials FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update credentials"
  ON public.venue_api_credentials FOR UPDATE TO authenticated USING (true);

-- Service role has full access
CREATE POLICY "Service role full access organizations"
  ON public.organizations FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access venue_organizations"
  ON public.venue_organizations FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access credentials"
  ON public.venue_api_credentials FOR ALL TO service_role USING (true);

-- Trigger for updated_at (reuse existing function if available)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.venue_api_credentials'::regclass) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.venue_api_credentials
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END$$;

-- Comments for documentation
COMMENT ON TABLE public.organizations IS 'Organization groupings for venues (e.g., Noxfolk owns Manor and Hippie)';
COMMENT ON TABLE public.venue_organizations IS 'Maps venues to their parent organizations';
COMMENT ON TABLE public.venue_api_credentials IS 'Encrypted API credentials with flexible scoping: per-venue, per-org, or global';
COMMENT ON COLUMN public.venue_api_credentials.venue IS 'Set for per-venue credentials (Square, Gmail). NULL for org-level or global.';
COMMENT ON COLUMN public.venue_api_credentials.organization_id IS 'Set for per-organization credentials (Xero). NULL for venue-level or global.';
COMMENT ON COLUMN public.venue_api_credentials.credentials_encrypted IS 'AES-256-GCM encrypted JSON containing integration-specific credentials';
