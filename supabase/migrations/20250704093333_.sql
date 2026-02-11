
-- Fix the venue mapping to properly use square_locations table
CREATE OR REPLACE FUNCTION public.get_venue_from_payment(payment_data jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  location_id TEXT;
  venue_name TEXT;
BEGIN
  -- Get location_id from payment
  location_id := payment_data->>'location_id';
  
  -- Look up venue name from square_locations table
  SELECT location_name INTO venue_name
  FROM square_locations 
  WHERE square_location_id = location_id 
  AND is_active = true;
  
  -- Return the mapped venue name, or default to 'default'
  RETURN COALESCE(venue_name, 'default');
END;
$$;

-- Fix the revenue type mapping to properly use square_locations table
CREATE OR REPLACE FUNCTION public.get_revenue_type_from_payment(payment_data jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  location_id TEXT;
  venue_name TEXT;
BEGIN
  -- Get location_id from payment
  location_id := payment_data->>'location_id';
  
  -- Look up venue name from square_locations table
  SELECT location_name INTO venue_name
  FROM square_locations 
  WHERE square_location_id = location_id 
  AND is_active = true;
  
  -- Map venue to revenue type
  RETURN CASE COALESCE(venue_name, 'default')
    WHEN 'Hippie Door' THEN 'door'
    WHEN 'Hippie Bar' THEN 'bar'
    WHEN 'Manor Bar' THEN 'bar'
    ELSE 'bar'  -- Default fallback
  END;
END;
$$;

-- Also update the test_map_all_transactions function to use proper venue mapping
CREATE OR REPLACE FUNCTION public.test_map_all_transactions()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  processed_count INTEGER := 0;
  sample_results JSON;
BEGIN
  -- Insert ALL transactions from raw payments to revenue_events
  WITH recent_payments AS (
    SELECT 
      spr.square_payment_id,
      spr.raw_response,
      -- Map venue from location_id using square_locations table
      COALESCE(sl.location_name, 'default') as venue_name,
      -- Extract payment details
      (spr.raw_response->>'created_at')::TIMESTAMP WITH TIME ZONE as payment_timestamp,
      (spr.raw_response->'amount_money'->>'amount')::INTEGER as amount_cents,
      COALESCE(spr.raw_response->'amount_money'->>'currency', 'USD') as currency
    FROM square_payments_raw spr
    LEFT JOIN square_locations sl ON sl.square_location_id = spr.raw_response->>'location_id'
    WHERE COALESCE(spr.raw_response->>'status', 'COMPLETED') = 'COMPLETED'
    ORDER BY spr.synced_at DESC
    -- No LIMIT - process ALL transactions
  )
  INSERT INTO revenue_events (
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
    rp.square_payment_id,
    rp.venue_name,
    -- Use the updated function that properly maps venue to revenue type
    get_revenue_type_from_payment(rp.raw_response) as revenue_type,
    rp.amount_cents,
    rp.currency,
    rp.payment_timestamp,
    EXTRACT(HOUR FROM rp.payment_timestamp)::INTEGER,
    EXTRACT(DOW FROM rp.payment_timestamp)::INTEGER,
    'completed',
    NOW()
  FROM recent_payments rp
  ON CONFLICT (square_payment_id) 
  DO UPDATE SET
    venue = EXCLUDED.venue,
    revenue_type = EXCLUDED.revenue_type,
    amount_cents = EXCLUDED.amount_cents,
    payment_date = EXCLUDED.payment_date,
    payment_hour = EXCLUDED.payment_hour,
    payment_day_of_week = EXCLUDED.payment_day_of_week,
    updated_at = NOW();
  
  -- Get count of processed records
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Get sample results for verification
  SELECT json_agg(row_to_json(re.*)) INTO sample_results
  FROM (
    SELECT square_payment_id, venue, revenue_type, amount_cents, payment_date
    FROM revenue_events 
    ORDER BY processed_at DESC 
    LIMIT 10
  ) re;
  
  -- Return results
  RETURN json_build_object(
    'success', true,
    'processed_count', processed_count,
    'sample_results', sample_results,
    'message', 'Successfully mapped ' || processed_count || ' transactions to revenue_events with proper venue-based revenue types'
  );
END;
$$;
;
