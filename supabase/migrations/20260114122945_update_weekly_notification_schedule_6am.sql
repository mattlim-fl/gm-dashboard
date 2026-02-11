-- Update weekly notification schedule to Wednesday 6 AM AWST
-- AWST is UTC+8, so 6 AM AWST = 10 PM Tuesday UTC

-- First, unschedule the existing cron job
SELECT cron.unschedule('weekly-summary-notification');

-- Create new cron job for Wednesday 6 AM AWST
-- Tuesday = 2 in cron (0=Sunday, 1=Monday, 2=Tuesday...)
SELECT cron.schedule(
  'weekly-summary-notification',
  '0 22 * * 2',  -- Every Tuesday at 10 PM UTC (Wednesday 6 AM AWST)
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/weekly-summary',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);;
