-- Revert functions to use created_at to match the user's working SQL query
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
  WHERE created_at >= start_date
    AND created_at < end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;

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
  WHERE revenue_type = 'bar'
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
  WHERE revenue_type = 'door'
    AND created_at >= start_date
    AND created_at < end_date
    AND (venue_filter IS NULL OR venue = venue_filter);
  RETURN total_revenue;
END;
$$;;
