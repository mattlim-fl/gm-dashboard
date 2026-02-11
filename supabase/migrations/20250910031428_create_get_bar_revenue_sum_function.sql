-- Create a simple RPC function to sum bar revenue from revenue_events
CREATE OR REPLACE FUNCTION public.get_bar_revenue_sum(
  start_date timestamptz,
  end_date timestamptz,
  venue_filter text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  total_revenue bigint;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO total_revenue
  FROM revenue_events
  WHERE status = 'completed'
    AND revenue_type = 'bar'
    AND payment_date >= start_date
    AND payment_date <= end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;;
