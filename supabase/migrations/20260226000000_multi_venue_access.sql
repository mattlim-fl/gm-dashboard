-- Multi-venue user access control
-- This migration creates the user_venue_access table and helper functions
-- to implement venue-based access control.

-- User-to-venue access mapping
CREATE TABLE public.user_venue_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  venue text NOT NULL CHECK (venue IN ('manor', 'hippie', 'daisy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(email, venue)
);

CREATE INDEX idx_user_venue_access_email ON public.user_venue_access(email);

-- Enable RLS
ALTER TABLE public.user_venue_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage all user_venue_access records
CREATE POLICY "Admins can manage user_venue_access"
  ON public.user_venue_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

-- Users can read their own venue access
CREATE POLICY "Users can read own venue_access"
  ON public.user_venue_access FOR SELECT
  USING (email = auth.jwt()->>'email');

-- Helper function: Check if user can access a venue
CREATE OR REPLACE FUNCTION public.user_has_venue_access(check_venue text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    -- Admins have access to all venues
    SELECT 1 FROM public.allowed_emails ae
    WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
  ) OR EXISTS (
    -- Regular users need explicit venue access
    SELECT 1 FROM public.user_venue_access uva
    WHERE uva.email = auth.jwt()->>'email' AND uva.venue = check_venue
  );
$$;

-- Helper function: Get user's accessible venues
CREATE OR REPLACE FUNCTION public.get_user_venues()
RETURNS text[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT CASE
    -- Admins get all venues
    WHEN EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    ) THEN ARRAY['manor', 'hippie', 'daisy']
    -- Regular users get their assigned venues
    ELSE (
      SELECT COALESCE(array_agg(venue ORDER BY venue), ARRAY[]::text[])
      FROM public.user_venue_access uva
      WHERE uva.email = auth.jwt()->>'email'
    )
  END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_has_venue_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_venues() TO authenticated;
