-- Allow anonymous users to check if their email is in allowed_emails
-- This is needed for the invite flow where users check if they're invited before signing up

CREATE POLICY "Anon can check allowed_emails"
  ON public.allowed_emails
  FOR SELECT
  TO anon
  USING (true);;
