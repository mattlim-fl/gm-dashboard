-- Create function to calculate attendance from revenue_event_items table
CREATE OR REPLACE FUNCTION public.get_weekly_attendance_summary(
  venue_filter TEXT DEFAULT NULL,
  week_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  week_start TIMESTAMP WITH TIME ZONE,
  total_attendance BIGINT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('week', rei.occurred_at) as week_start,
    COALESCE(SUM(rei.quantity), 0) as total_attendance
  FROM revenue_event_items rei
  JOIN revenue_events re ON rei.event_id = re.id
  WHERE re.status = 'completed'
    AND rei.occurred_at IS NOT NULL
    AND (venue_filter IS NULL OR re.venue = venue_filter)
    AND (week_date IS NULL OR DATE_TRUNC('week', rei.occurred_at) = DATE_TRUNC('week', week_date))
  GROUP BY DATE_TRUNC('week', rei.occurred_at)
  ORDER BY week_start DESC;
END;
$function$;;
