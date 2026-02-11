-- Fix the bar and door revenue functions to exactly match the user's SQL query logic
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
    AND created_at >= start_date
    AND created_at < end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_door_revenue_sum(
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
    AND revenue_type = 'door'
    AND created_at >= start_date
    AND created_at < end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;;
