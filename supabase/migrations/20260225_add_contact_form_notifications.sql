-- Add contact form notification types for email routing
-- Each venue has its own settings for lost property, scantech, and general inquiries

DO $$
BEGIN
  -- Step 1: Drop the old constraint
  ALTER TABLE public.notification_settings
  DROP CONSTRAINT IF EXISTS notification_settings_notification_type_check;

  -- Step 2: Add new constraint with contact form types
  ALTER TABLE public.notification_settings
  ADD CONSTRAINT notification_settings_notification_type_check
  CHECK (notification_type IN (
    -- Existing types
    'trade_report',
    'business_performance',
    -- Contact form types - Manor
    'manor_contact_lost_property',
    'manor_contact_scantech',
    'manor_contact_general',
    -- Contact form types - Hippie
    'hippie_contact_lost_property',
    'hippie_contact_scantech',
    'hippie_contact_general',
    -- Contact form types - Daisy's
    'daisys_contact_lost_property',
    'daisys_contact_scantech',
    'daisys_contact_general'
  ));

  -- Step 3: Insert Manor contact form settings
  INSERT INTO public.notification_settings (notification_type, enabled, recipient_emails, whatsapp_numbers)
  VALUES
    ('manor_contact_lost_property', true, '{}', '{}'),
    ('manor_contact_scantech', true, '{}', '{}'),
    ('manor_contact_general', true, '{}', '{}')
  ON CONFLICT (notification_type) DO NOTHING;

  -- Step 4: Insert Hippie contact form settings
  INSERT INTO public.notification_settings (notification_type, enabled, recipient_emails, whatsapp_numbers)
  VALUES
    ('hippie_contact_lost_property', true, '{}', '{}'),
    ('hippie_contact_scantech', true, '{}', '{}'),
    ('hippie_contact_general', true, '{}', '{}')
  ON CONFLICT (notification_type) DO NOTHING;

  -- Step 5: Insert Daisy's contact form settings
  INSERT INTO public.notification_settings (notification_type, enabled, recipient_emails, whatsapp_numbers)
  VALUES
    ('daisys_contact_lost_property', true, '{}', '{}'),
    ('daisys_contact_scantech', true, '{}', '{}'),
    ('daisys_contact_general', true, '{}', '{}')
  ON CONFLICT (notification_type) DO NOTHING;

END $$;

-- Add RLS policy for inserting (needed for Edge Function with service role)
DROP POLICY IF EXISTS "Service role can insert notification settings" ON notification_settings;
CREATE POLICY "Service role can insert notification settings"
  ON notification_settings FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE notification_settings IS 'Stores configuration for automated notifications and contact form email routing';
