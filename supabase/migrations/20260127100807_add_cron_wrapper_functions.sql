-- Wrapper function to schedule a cron job
CREATE OR REPLACE FUNCTION public.schedule_cron_job(
  job_name TEXT,
  schedule TEXT,
  command TEXT
) RETURNS BIGINT AS $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT cron.schedule(job_name, schedule, command) INTO job_id;
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper function to unschedule a cron job
CREATE OR REPLACE FUNCTION public.unschedule_cron_job(
  job_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  PERFORM cron.unschedule(job_name);
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO service_role;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO service_role;;
