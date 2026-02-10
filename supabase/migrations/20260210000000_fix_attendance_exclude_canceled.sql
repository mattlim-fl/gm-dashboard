-- Fix attendance calculation to exclude CANCELED orders
-- Previously: counted all orders regardless of status
-- Now: only counts COMPLETED orders (matches Square's "Closed Bills" report)

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
      SELECT COALESCE(SUM(door_ticket_qty), 0)
      FROM orders
      WHERE order_created_at >= start_date
        AND order_created_at <= end_date
        AND venue = 'Hippie Door'
        AND status = 'COMPLETED'
    );
  ELSE
    RETURN (
      SELECT COALESCE(SUM(door_ticket_qty), 0)
      FROM orders
      WHERE order_created_at >= start_date
        AND order_created_at <= end_date
        AND venue = venue_filter
        AND status = 'COMPLETED'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_attendance_sum IS 'Returns attendance count from orders table door_ticket_qty. Only counts COMPLETED orders (excludes CANCELED). Excludes RE-ENTRY (re-admissions). Includes: Hippie Entry, Complimentary Entry, Free Entry, Megatix, Custom Amount.';
