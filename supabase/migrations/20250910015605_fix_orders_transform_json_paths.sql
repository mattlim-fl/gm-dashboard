-- Fix the transform function to use correct JSON paths from square_orders_raw
CREATE OR REPLACE FUNCTION public.transform_square_orders_to_normalized(p_limit integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  affected int := 0;
  -- Names that represent door/entry tickets; align with revenue_event_items logic
  door_names text[] := ARRAY['Hippie Entry','RE-ENTRY','Complimentary Entry'];
  venue_name text;
BEGIN
  FOR r IN
    SELECT
      o.order_id,
      o.raw_response,
      o.raw_response->>'location_id' AS location_id,
      p.square_payment_id AS payment_id
    FROM public.square_orders_raw o
    LEFT JOIN public.square_payments_raw p ON p.raw_response->>'order_id' = o.order_id
    -- process only orders not yet in normalized table
    LEFT JOIN public.orders n ON n.order_id = o.order_id
    WHERE n.order_id IS NULL
    LIMIT p_limit
  LOOP
    -- Map venue from location id
    SELECT sl.location_name INTO venue_name
    FROM public.square_locations sl
    WHERE sl.square_location_id = r.location_id;

    INSERT INTO public.orders (
      order_id, payment_id, location_id, venue, status, order_created_at, order_updated_at,
      total_money_cents, door_ticket_qty, line_items, synced_at
    )
    VALUES (
      r.order_id,
      r.payment_id,
      r.location_id,
      venue_name,
      r.raw_response->>'state',
      (r.raw_response->>'created_at')::timestamptz,
      (r.raw_response->>'updated_at')::timestamptz,
      NULLIF(r.raw_response->'total_money'->>'amount','')::int,
      (
        SELECT COALESCE(SUM(
                 CASE
                   WHEN NULLIF(li->>'quantity','') IS NULL THEN 1
                   ELSE GREATEST(1, NULLIF(li->>'quantity','')::int)
                 END
               ), 0)
        FROM jsonb_array_elements(COALESCE(r.raw_response->'line_items','[]'::jsonb)) li
        WHERE (li->>'name') = ANY(door_names)
      ),
      r.raw_response->'line_items',
      now()
    )
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

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END $$;;
