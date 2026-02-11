-- Phase 2: Consolidate Database Functions (Fixed)
-- Replace multiple date-specific functions with single parameterized versions

-- Drop existing date-specific functions
DROP FUNCTION IF EXISTS public.get_weekly_revenue_summary_by_date(timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.get_monthly_revenue_summary_by_date(timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.get_yearly_revenue_summary_by_date(timestamp with time zone, text);

-- Update weekly summary function to handle optional date filtering
CREATE OR REPLACE FUNCTION public.get_weekly_revenue_summary(
  venue_filter TEXT DEFAULT NULL,
  week_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  week_start TIMESTAMP WITH TIME ZONE,
  total_transactions BIGINT,
  door_transactions BIGINT,
  bar_transactions BIGINT,
  door_revenue_cents BIGINT,
  bar_revenue_cents BIGINT,
  total_revenue_cents BIGINT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('week', payment_date) as week_start,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'door') as door_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'bar') as bar_transactions,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'door'), 0) as door_revenue_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'bar'), 0) as bar_revenue_cents,
    SUM(amount_cents) as total_revenue_cents
  FROM revenue_events 
  WHERE status = 'completed'
    AND (venue_filter IS NULL OR venue = venue_filter)
    AND (week_date IS NULL OR DATE_TRUNC('week', payment_date) = DATE_TRUNC('week', week_date))
  GROUP BY DATE_TRUNC('week', payment_date)
  ORDER BY week_start DESC;
END;
$function$;

-- Update monthly summary function to handle optional date filtering
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_summary(
  venue_filter TEXT DEFAULT NULL,
  month_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  month TIMESTAMP WITH TIME ZONE,
  total_transactions BIGINT,
  door_transactions BIGINT,
  bar_transactions BIGINT,
  door_revenue_cents BIGINT,
  bar_revenue_cents BIGINT,
  total_revenue_cents BIGINT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', payment_date) as month,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'door') as door_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'bar') as bar_transactions,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'door'), 0) as door_revenue_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'bar'), 0) as bar_revenue_cents,
    SUM(amount_cents) as total_revenue_cents
  FROM revenue_events 
  WHERE status = 'completed'
    AND (venue_filter IS NULL OR venue = venue_filter)
    AND (month_date IS NULL OR DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', month_date))
  GROUP BY DATE_TRUNC('month', payment_date)
  ORDER BY month DESC;
END;
$function$;

-- Update yearly summary function to handle optional date filtering
CREATE OR REPLACE FUNCTION public.get_yearly_revenue_summary(
  venue_filter TEXT DEFAULT NULL,
  year_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  year_start TIMESTAMP WITH TIME ZONE,
  total_transactions BIGINT,
  door_transactions BIGINT,
  bar_transactions BIGINT,
  door_revenue_cents BIGINT,
  bar_revenue_cents BIGINT,
  total_revenue_cents BIGINT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('year', payment_date) as year_start,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'door') as door_transactions,
    COUNT(*) FILTER (WHERE revenue_type = 'bar') as bar_transactions,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'door'), 0) as door_revenue_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE revenue_type = 'bar'), 0) as bar_revenue_cents,
    SUM(amount_cents) as total_revenue_cents
  FROM revenue_events 
  WHERE status = 'completed'
    AND (venue_filter IS NULL OR venue = venue_filter)
    AND (year_date IS NULL OR DATE_TRUNC('year', payment_date) = DATE_TRUNC('year', year_date))
  GROUP BY DATE_TRUNC('year', payment_date)
  ORDER BY year_start DESC;
END;
$function$;

-- Remove redundant processing functions that will move to edge function
DROP FUNCTION IF EXISTS public.process_payment_to_revenue(text);
DROP FUNCTION IF EXISTS public.get_venue_from_payment(jsonb);
DROP FUNCTION IF EXISTS public.get_revenue_type_from_payment(jsonb);

-- Add indexes for common query patterns (using payment_date directly)
CREATE INDEX IF NOT EXISTS idx_revenue_events_payment_date ON revenue_events (payment_date);
CREATE INDEX IF NOT EXISTS idx_revenue_events_venue_status ON revenue_events (venue, status);
CREATE INDEX IF NOT EXISTS idx_revenue_events_revenue_type ON revenue_events (revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_status ON revenue_events (status);;
