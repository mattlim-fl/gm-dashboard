-- Update weekly notification schedule from Sunday 6 AM to Wednesday 8 AM AWST
-- This migration updates the existing cron job to run on Wednesday mornings instead of Sunday mornings

-- First, unschedule the existing cron job
SELECT cron.unschedule('weekly-summary-notification');

-- Create new cron job for Wednesday 8 AM AWST
-- AWST is UTC+8, so 8 AM AWST = 12 AM (midnight) Wednesday UTC
-- Cron format: minute hour day-of-month month day-of-week
-- Wednesday = 3 in cron (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday...)
SELECT cron.schedule(
  'weekly-summary-notification',
  '0 0 * * 3',  -- Every Wednesday at 12 AM UTC (Wednesday 8 AM AWST)
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/weekly-summary',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);;
