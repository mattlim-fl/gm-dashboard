-- Update function to accept venue parameter for filtering
DROP FUNCTION IF EXISTS public.get_monthly_revenue_summary();

-- Create function that accepts venue parameter (NULL for all venues)
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_summary(venue_filter TEXT DEFAULT NULL)
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
  GROUP BY DATE_TRUNC('month', payment_date)
  ORDER BY month DESC;
END;
$function$;
