-- Phase 1: Add business_performance notification type and schedule fields
-- This migration transforms the notification system to support multiple notification types
-- with configurable schedules

DO $$
BEGIN
  -- Step 1: Add schedule fields to notification_settings table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_settings' AND column_name = 'schedule_day_of_week'
  ) THEN
    ALTER TABLE public.notification_settings 
    ADD COLUMN schedule_day_of_week INTEGER; -- 0=Sunday, 1=Monday, ..., 6=Saturday
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_settings' AND column_name = 'schedule_hour_awst'
  ) THEN
    ALTER TABLE public.notification_settings 
    ADD COLUMN schedule_hour_awst INTEGER; -- 0-23 (hour in AWST)
  END IF;

  -- Step 2: Drop the old constraint
  ALTER TABLE public.notification_settings 
  DROP CONSTRAINT IF EXISTS notification_settings_notification_type_check;

  -- Step 3: Rename existing 'weekly_summary' to 'trade_report'
  UPDATE public.notification_settings 
  SET 
    notification_type = 'trade_report',
    schedule_day_of_week = 0, -- Sunday
    schedule_hour_awst = 6 -- 6 AM AWST
  WHERE notification_type = 'weekly_summary';

  -- Step 4: Add new constraint with only the new types
  ALTER TABLE public.notification_settings 
  ADD CONSTRAINT notification_settings_notification_type_check 
  CHECK (notification_type IN ('trade_report', 'business_performance'));

  -- Step 5: Insert new 'business_performance' notification settings
  INSERT INTO public.notification_settings (
    notification_type, 
    enabled, 
    recipient_emails, 
    whatsapp_numbers,
    schedule_day_of_week,
    schedule_hour_awst
  )
  VALUES (
    'business_performance', 
    true, 
    '{}', 
    '{}',
    3, -- Wednesday
    6  -- 6 AM AWST
  )
  ON CONFLICT (notification_type) DO NOTHING;
END $$;

-- Step 6: Unschedule old cron jobs (if they exist)
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-summary-notification');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trade-report-notification');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('business-performance-notification');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

-- Step 7: Create cron job for trade report (Sunday 6 AM AWST = Saturday 10 PM UTC)
SELECT cron.schedule(
  'trade-report-notification',
  '0 22 * * 6',  -- Saturday 10 PM UTC = Sunday 6 AM AWST
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/trade-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Step 8: Create cron job for business performance (Wednesday 6 AM AWST = Tuesday 10 PM UTC)
SELECT cron.schedule(
  'business-performance-notification',
  '0 22 * * 2',  -- Tuesday 10 PM UTC = Wednesday 6 AM AWST
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/business-performance',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Add comments for documentation
COMMENT ON COLUMN notification_settings.schedule_day_of_week IS 'Day of week for notification delivery (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN notification_settings.schedule_hour_awst IS 'Hour of day for notification delivery in AWST timezone (0-23)';
