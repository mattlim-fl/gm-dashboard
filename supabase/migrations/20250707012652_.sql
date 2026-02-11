-- Update weekly revenue summary to support date filtering
CREATE OR REPLACE FUNCTION public.get_weekly_revenue_summary_by_date(
  week_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  venue_filter TEXT DEFAULT NULL
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
    AND (week_start_date IS NULL OR DATE_TRUNC('week', payment_date) = DATE_TRUNC('week', week_start_date))
  GROUP BY DATE_TRUNC('week', payment_date)
  ORDER BY week_start DESC;
END;
$function$;
