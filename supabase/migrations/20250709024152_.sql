
-- Enable required extensions for automated syncing
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to sync Square data every 15 minutes
SELECT cron.schedule(
  'square-sync-job',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/square-cron',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);
;
