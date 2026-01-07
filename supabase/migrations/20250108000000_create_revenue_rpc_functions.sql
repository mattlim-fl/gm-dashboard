-- Create RPC function to get revenue sum for a date range
CREATE OR REPLACE FUNCTION public.get_revenue_sum(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  venue_filter TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
BEGIN
  IF venue_filter IS NULL OR venue_filter = 'all' THEN
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND payment_date >= start_date
        AND payment_date <= end_date
    );
  ELSE
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND payment_date >= start_date
        AND payment_date <= end_date
        AND venue = venue_filter
    );
  END IF;
END;
$$;

-- Create RPC function to get attendance sum for a date range
-- Attendance is calculated as the count of door transactions
CREATE OR REPLACE FUNCTION public.get_attendance_sum(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  venue_filter TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
BEGIN
  IF venue_filter IS NULL OR venue_filter = 'all' THEN
    RETURN (
      SELECT COUNT(*)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'door'
        AND payment_date >= start_date
        AND payment_date <= end_date
    );
  ELSE
    RETURN (
      SELECT COUNT(*)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'door'
        AND payment_date >= start_date
        AND payment_date <= end_date
        AND venue = venue_filter
    );
  END IF;
END;
$$;

-- Create RPC function to get bar revenue sum for a date range
CREATE OR REPLACE FUNCTION public.get_bar_revenue_sum(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  venue_filter TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
BEGIN
  IF venue_filter IS NULL OR venue_filter = 'all' THEN
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'bar'
        AND payment_date >= start_date
        AND payment_date <= end_date
    );
  ELSE
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'bar'
        AND payment_date >= start_date
        AND payment_date <= end_date
        AND venue = venue_filter
    );
  END IF;
END;
$$;

-- Create RPC function to get door revenue sum for a date range
CREATE OR REPLACE FUNCTION public.get_door_revenue_sum(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  venue_filter TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
BEGIN
  IF venue_filter IS NULL OR venue_filter = 'all' THEN
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'door'
        AND payment_date >= start_date
        AND payment_date <= end_date
    );
  ELSE
    RETURN (
      SELECT COALESCE(SUM(amount_cents), 0)
      FROM revenue_events
      WHERE status = 'completed'
        AND revenue_type = 'door'
        AND payment_date >= start_date
        AND payment_date <= end_date
        AND venue = venue_filter
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_revenue_sum IS 'Returns total revenue in cents for a given date range and optional venue filter';
COMMENT ON FUNCTION public.get_attendance_sum IS 'Returns attendance count (door transactions) for a given date range and optional venue filter';
COMMENT ON FUNCTION public.get_bar_revenue_sum IS 'Returns bar revenue in cents for a given date range and optional venue filter';
COMMENT ON FUNCTION public.get_door_revenue_sum IS 'Returns door revenue in cents for a given date range and optional venue filter';

