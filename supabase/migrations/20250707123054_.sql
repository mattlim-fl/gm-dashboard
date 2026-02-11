-- Create function to get monthly revenue summary
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_summary()
RETURNS TABLE(
  month TIMESTAMP WITH TIME ZONE,
  total_transactions BIGINT,
  total_cents BIGINT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', payment_date) as month,
    COUNT(*) as total_transactions,
    SUM(amount_cents) as total_cents
  FROM revenue_events 
  WHERE status = 'completed'
  GROUP BY DATE_TRUNC('month', payment_date)
  ORDER BY month DESC;
END;
$function$;
