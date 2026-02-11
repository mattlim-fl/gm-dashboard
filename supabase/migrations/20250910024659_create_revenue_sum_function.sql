-- Create a simple function to sum revenue for a date range
CREATE OR REPLACE FUNCTION public.get_revenue_sum(
  start_date timestamptz,
  end_date timestamptz,
  venue_filter text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(amount_cents), 0)
    FROM revenue_events
    WHERE status = 'completed'
      AND payment_date >= start_date
      AND payment_date <= end_date
      AND (venue_filter IS NULL OR venue = venue_filter)
  );
END;
$$;;
