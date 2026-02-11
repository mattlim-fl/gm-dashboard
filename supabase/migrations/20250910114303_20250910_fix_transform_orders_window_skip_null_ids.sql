CREATE OR REPLACE FUNCTION public.transform_orders_window(
  start_ts TIMESTAMPTZ,
  end_ts TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_skipped_null_ids INTEGER := 0;
BEGIN
  -- Count rows in window with missing order IDs (will be skipped)
  SELECT COUNT(*) INTO v_skipped_null_ids
  FROM public.square_orders_raw sor
  WHERE sor.synced_at >= start_ts
    AND sor.synced_at <= end_ts
    AND NULLIF(sor.raw_response->>'id','') IS NULL;

  -- Upsert curated orders from raw within window, skipping rows without an order_id
  WITH src AS (
    SELECT 
      (sor.raw_response->>'id') AS order_id,
      COALESCE((sor.raw_response->'tenders'->0->>'payment_id'), NULL) AS payment_id,
      (sor.raw_response->>'location_id') AS location_id,
      (sor.raw_response->>'state') AS status,
      (sor.raw_response->>'created_at')::timestamptz AS order_created_at,
      (sor.raw_response->>'updated_at')::timestamptz AS order_updated_at,
      COALESCE((sor.raw_response->'total_money'->>'amount')::int, 0) AS total_money_cents,
      sor.raw_response->'line_items' AS line_items,
      sor.synced_at
    FROM public.square_orders_raw sor
    WHERE sor.synced_at >= start_ts
      AND sor.synced_at <= end_ts
      AND NULLIF(sor.raw_response->>'id','') IS NOT NULL
  )
  INSERT INTO public.orders (
    order_id, payment_id, location_id, venue, status, order_created_at, order_updated_at, total_money_cents, line_items, synced_at
  )
  SELECT 
    s.order_id,
    s.payment_id,
    s.location_id,
    COALESCE(sl.location_name, 'default') AS venue,
    COALESCE(s.status, 'OPEN') AS status,
    s.order_created_at,
    s.order_updated_at,
    s.total_money_cents,
    s.line_items,
    now() AS synced_at
  FROM src s
  LEFT JOIN public.square_locations sl ON sl.square_location_id = s.location_id
  ON CONFLICT (order_id) DO UPDATE SET
    payment_id = EXCLUDED.payment_id,
    location_id = EXCLUDED.location_id,
    venue = EXCLUDED.venue,
    status = EXCLUDED.status,
    order_created_at = EXCLUDED.order_created_at,
    order_updated_at = EXCLUDED.order_updated_at,
    total_money_cents = EXCLUDED.total_money_cents,
    line_items = EXCLUDED.line_items,
    synced_at = EXCLUDED.synced_at;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  RETURN json_build_object(
    'processed_count', v_processed_count,
    'skipped_null_ids', v_skipped_null_ids,
    'start_ts', start_ts,
    'end_ts', end_ts
  );
END;
$$;;
