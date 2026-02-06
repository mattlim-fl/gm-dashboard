-- Add wrapper functions for pg_cron that can be called via PostgREST/RPC
-- pg_cron functions are in the 'cron' schema and cannot be called directly via supabase.rpc()

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
    -- Job might not exist, return false
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO service_role;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO service_role;

-- Add comments
COMMENT ON FUNCTION public.schedule_cron_job IS 'Wrapper for cron.schedule() callable via PostgREST RPC';
COMMENT ON FUNCTION public.unschedule_cron_job IS 'Wrapper for cron.unschedule() callable via PostgREST RPC';
