-- Phase 2: Add cron management capabilities
-- This migration adds helper functions for managing notification schedules

-- Helper function to convert AWST schedule to UTC cron expression
CREATE OR REPLACE FUNCTION public.get_cron_expression(day_of_week INTEGER, hour_awst INTEGER)
RETURNS TEXT AS $$
DECLARE
  utc_hour INTEGER;
  utc_day INTEGER;
BEGIN
  -- AWST is UTC+8
  utc_hour := hour_awst - 8;
  utc_day := day_of_week;
  
  -- Handle day rollback if hour goes negative
  IF utc_hour < 0 THEN
    utc_hour := utc_hour + 24;
    utc_day := (day_of_week - 1 + 7) % 7;
  END IF;
  
  -- Return cron expression: 'minute hour * * day_of_week'
  RETURN '0 ' || utc_hour || ' * * ' || utc_day;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION public.get_cron_expression IS 'Converts AWST day/hour to UTC cron expression for pg_cron';

-- Add cron_job_name column to track pg_cron job names
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS cron_job_name TEXT;

-- Update existing records with their cron job names
UPDATE public.notification_settings 
SET cron_job_name = notification_type || '-notification'
WHERE cron_job_name IS NULL;

-- Add comment
COMMENT ON COLUMN notification_settings.cron_job_name IS 'Name of the pg_cron job for this notification';
