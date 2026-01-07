-- Enable required extensions (should already be enabled from previous migration)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to send weekly notifications every Sunday at 6 AM AWST
-- AWST is UTC+8, so 6 AM AWST = 10 PM Saturday UTC
-- Cron format: minute hour day-of-month month day-of-week
-- Saturday = 6 in cron
SELECT cron.schedule(
  'weekly-summary-notification',
  '0 22 * * 6',  -- Every Saturday at 10 PM UTC (Sunday 6 AM AWST)
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/weekly-summary',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

