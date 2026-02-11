-- Fix the get_weekly_revenue_summary function to use actual payment dates instead of truncated weeks
CREATE OR REPLACE FUNCTION public.get_weekly_revenue_summary(venue_filter text DEFAULT NULL::text, week_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(week_start timestamp with time zone, total_transactions bigint, door_transactions bigint, bar_transactions bigint, door_revenue_cents bigint, bar_revenue_cents bigint, total_revenue_cents bigint)
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
$function$;;
