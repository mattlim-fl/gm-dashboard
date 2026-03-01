-- Fix the Square sync cron job to call the correct function name
-- The old job was calling 'square-cron' which doesn't exist
-- The correct function is 'sync-scheduler'

-- Try to unschedule any existing job (ignore if not found)
DO $$
BEGIN
  PERFORM cron.unschedule('square-sync-job');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

-- Create the new cron job with the correct function name
-- Runs every 15 minutes to trigger the sync-scheduler
SELECT cron.schedule(
  'square-sync-job',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/sync-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3N2YXRqZHlscHVoaml0YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjQ5MzMsImV4cCI6MjA2NjM0MDkzM30.IdM8u1iq88C0ruwp7IkMB7PxwnfwmRyl6uLnBmZq5ys"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);
