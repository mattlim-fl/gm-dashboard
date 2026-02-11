-- Create monthly revenue summary with date filtering
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_summary_by_date(
  month_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  venue_filter TEXT DEFAULT NULL
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
    AND (month_start_date IS NULL OR DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', month_start_date))
  GROUP BY DATE_TRUNC('month', payment_date)
  ORDER BY month DESC;
END;
$function$;

-- Create yearly revenue summary with date filtering
CREATE OR REPLACE FUNCTION public.get_yearly_revenue_summary_by_date(
  year_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  venue_filter TEXT DEFAULT NULL
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
    AND (year_start_date IS NULL OR DATE_TRUNC('year', payment_date) = DATE_TRUNC('year', year_start_date))
  GROUP BY DATE_TRUNC('year', payment_date)
  ORDER BY year_start DESC;
END;
$function$;

-- Create function to get available weeks for dropdown
CREATE OR REPLACE FUNCTION public.get_available_weeks()
RETURNS TABLE(
  week_start TIMESTAMP WITH TIME ZONE,
  week_label TEXT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('week', payment_date) as week_start,
    TO_CHAR(DATE_TRUNC('week', payment_date), 'YYYY-MM-DD') || ' (Week ' || 
    TO_CHAR(DATE_TRUNC('week', payment_date), 'WW') || ')' as week_label
  FROM revenue_events 
  WHERE status = 'completed'
  GROUP BY DATE_TRUNC('week', payment_date)
  ORDER BY week_start DESC
  LIMIT 52;
END;
$function$;
