CREATE OR REPLACE FUNCTION public.transform_backfill_transactions(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  processed_count INTEGER := 0;
  total_in_range INTEGER := 0;
  actual_start DATE;
  actual_end DATE;
BEGIN
  actual_start := COALESCE(start_date, CURRENT_DATE - INTERVAL '2 years');
  actual_end := COALESCE(end_date, CURRENT_DATE);

  -- Count total payments in range
  SELECT COUNT(*) INTO total_in_range
  FROM public.square_payments_raw spr
  WHERE (spr.raw_response->>'created_at')::DATE >= actual_start
    AND (spr.raw_response->>'created_at')::DATE <= actual_end
    AND COALESCE(spr.raw_response->>'status','COMPLETED') = 'COMPLETED';

  -- Transform and upsert into revenue_events
  WITH src AS (
    SELECT 
      spr.square_payment_id,
      (spr.raw_response->>'created_at')::timestamptz AS payment_ts,
      (spr.raw_response->'amount_money'->>'amount')::int AS amount_cents,
      COALESCE(spr.raw_response->'amount_money'->>'currency','USD') AS currency,
      sl.location_name AS venue
    FROM public.square_payments_raw spr
    LEFT JOIN public.square_locations sl
      ON sl.square_location_id = spr.raw_response->>'location_id'
    WHERE (spr.raw_response->>'created_at')::DATE >= actual_start
      AND (spr.raw_response->>'created_at')::DATE <= actual_end
      AND COALESCE(spr.raw_response->>'status','COMPLETED') = 'COMPLETED'
  )
  INSERT INTO public.revenue_events (
    square_payment_id,
    venue,
    revenue_type,
    amount_cents,
    currency,
    payment_date,
    payment_hour,
    payment_day_of_week,
    status,
    processed_at
  )
  SELECT 
    s.square_payment_id,
    COALESCE(s.venue, 'default') AS venue,
    CASE WHEN COALESCE(s.venue,'') ILIKE '%door%' THEN 'door' ELSE 'bar' END AS revenue_type,
    COALESCE(s.amount_cents, 0) AS amount_cents,
    COALESCE(s.currency,'USD') AS currency,
    s.payment_ts,
    EXTRACT(HOUR FROM s.payment_ts)::int AS payment_hour,
    EXTRACT(DOW FROM s.payment_ts)::int AS payment_day_of_week,
    'completed'::text,
    NOW()
  FROM src s
  ON CONFLICT (square_payment_id) DO UPDATE SET
    venue = EXCLUDED.venue,
    revenue_type = EXCLUDED.revenue_type,
    amount_cents = EXCLUDED.amount_cents,
    currency = EXCLUDED.currency,
    payment_date = EXCLUDED.payment_date,
    payment_hour = EXCLUDED.payment_hour,
    payment_day_of_week = EXCLUDED.payment_day_of_week,
    status = EXCLUDED.status,
    processed_at = EXCLUDED.processed_at;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  RETURN json_build_object(
    'processed_count', processed_count,
    'total_in_range', total_in_range,
    'start_date', actual_start,
    'end_date', actual_end
  );
END;
$$;;
