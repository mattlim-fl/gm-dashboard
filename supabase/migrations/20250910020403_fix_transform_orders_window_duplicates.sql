-- Fix the transform_orders_window function to handle duplicates
CREATE OR REPLACE FUNCTION public.transform_orders_window(p_start_ts timestamptz, p_end_ts timestamptz)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_affected integer := 0;
BEGIN
  WITH src AS (
    SELECT DISTINCT ON (o.order_id)
      o.order_id,
      p.square_payment_id AS payment_id,
      (o.raw_response->>'location_id') AS location_id,
      sl.location_name AS venue,
      (o.raw_response->>'state') AS status,
      (o.raw_response->>'created_at')::timestamptz AS order_created_at,
      (o.raw_response->>'updated_at')::timestamptz AS order_updated_at,
      NULLIF(o.raw_response->'total_money'->>'amount','')::int AS total_money_cents,
      (
        SELECT COALESCE(SUM(
                 CASE
                   WHEN NULLIF(li->>'quantity','') IS NULL THEN 1
                   ELSE GREATEST(1, NULLIF(li->>'quantity','')::int)
                 END
               ), 0)
        FROM jsonb_array_elements(COALESCE(o.raw_response->'line_items','[]'::jsonb)) li
        WHERE (li->>'name') = ANY(ARRAY['Hippie Entry','RE-ENTRY','Complimentary Entry'])
      ) AS door_ticket_qty,
      o.raw_response->'line_items' AS line_items
    FROM public.square_orders_raw o
    LEFT JOIN public.square_payments_raw p ON p.raw_response->>'order_id' = o.order_id
    LEFT JOIN public.square_locations sl ON sl.square_location_id = (o.raw_response->>'location_id')
    WHERE (o.raw_response->>'created_at')::timestamptz >= p_start_ts
      AND (o.raw_response->>'created_at')::timestamptz <= p_end_ts
    ORDER BY o.order_id, o.synced_at DESC
  )
  INSERT INTO public.orders (
    order_id, payment_id, location_id, venue, status,
    order_created_at, order_updated_at, total_money_cents,
    door_ticket_qty, line_items, synced_at
  )
  SELECT
    s.order_id, s.payment_id, s.location_id, s.venue, s.status,
    s.order_created_at, s.order_updated_at, s.total_money_cents,
    s.door_ticket_qty, s.line_items, now()
  FROM src s
  ON CONFLICT (order_id) DO UPDATE SET
    payment_id = EXCLUDED.payment_id,
    location_id = EXCLUDED.location_id,
    venue = COALESCE(EXCLUDED.venue, public.orders.venue),
    status = EXCLUDED.status,
    order_created_at = EXCLUDED.order_created_at,
    order_updated_at = EXCLUDED.order_updated_at,
    total_money_cents = EXCLUDED.total_money_cents,
    door_ticket_qty = EXCLUDED.door_ticket_qty,
    line_items = EXCLUDED.line_items,
    synced_at = now();

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END
$$;;
