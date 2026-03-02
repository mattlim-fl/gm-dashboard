-- Secure venue_api_credentials: admin-only access
-- Rationale: credentials should only be readable/writable by admins (and service_role).

-- Drop overly-broad authenticated policies
DROP POLICY IF EXISTS "Authenticated can view credentials" ON public.venue_api_credentials;
DROP POLICY IF EXISTS "Authenticated can insert credentials" ON public.venue_api_credentials;
DROP POLICY IF EXISTS "Authenticated can update credentials" ON public.venue_api_credentials;

-- Admin-only SELECT
CREATE POLICY "Admins can view venue_api_credentials"
  ON public.venue_api_credentials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- Admin-only INSERT
CREATE POLICY "Admins can insert venue_api_credentials"
  ON public.venue_api_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- Admin-only UPDATE
CREATE POLICY "Admins can update venue_api_credentials"
  ON public.venue_api_credentials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

