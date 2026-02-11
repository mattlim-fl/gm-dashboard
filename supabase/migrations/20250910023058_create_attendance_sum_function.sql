-- Create a simple function to sum attendance for a date range
CREATE OR REPLACE FUNCTION public.get_attendance_sum(
  start_date timestamptz,
  end_date timestamptz,
  venue_filter text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(door_ticket_qty), 0)
    FROM orders
    WHERE order_created_at >= start_date
      AND order_created_at <= end_date
      AND (venue_filter IS NULL OR venue = venue_filter)
  );
END;
$$;;
