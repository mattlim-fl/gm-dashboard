DROP POLICY IF EXISTS "Admins can manage allowed_emails" ON public.allowed_emails;

CREATE POLICY "Admins can manage allowed_emails"
  ON public.allowed_emails
  FOR ALL
  USING (auth.jwt()->>'email' = 'matt@getproductbox.com')
  WITH CHECK (auth.jwt()->>'email' = 'matt@getproductbox.com');;
