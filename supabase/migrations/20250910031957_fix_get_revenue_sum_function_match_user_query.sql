-- Fix get_revenue_sum function to match user's exact query logic
CREATE OR REPLACE FUNCTION public.get_revenue_sum(
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
  WHERE payment_date >= start_date
    AND payment_date < end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;;
