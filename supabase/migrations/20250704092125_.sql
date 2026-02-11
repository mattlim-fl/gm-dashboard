-- Update test function to process 1000 transactions instead of 100
CREATE OR REPLACE FUNCTION public.test_map_1000_transactions()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  processed_count INTEGER := 0;
  sample_results JSON;
BEGIN
  -- Insert 1000 recent transactions from raw payments to revenue_events
  WITH recent_payments AS (
    SELECT 
      spr.square_payment_id,
      spr.raw_response,
      -- Map venue from location_id
      COALESCE(sl.location_name, 'default') as venue_name,
      -- Extract payment details
      (spr.raw_response->>'created_at')::TIMESTAMP WITH TIME ZONE as payment_timestamp,
      (spr.raw_response->'amount_money'->>'amount')::INTEGER as amount_cents,
      COALESCE(spr.raw_response->'amount_money'->>'currency', 'USD') as currency
    FROM square_payments_raw spr
    LEFT JOIN square_locations sl ON sl.square_location_id = spr.raw_response->>'location_id'
    WHERE COALESCE(spr.raw_response->>'status', 'COMPLETED') = 'COMPLETED'
    ORDER BY spr.synced_at DESC
    LIMIT 1000
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
    get_revenue_type_from_payment(rp.raw_response) as revenue_type,
    rp.amount_cents,
    rp.currency,
    rp.payment_timestamp,
    EXTRACT(HOUR FROM rp.payment_timestamp)::INTEGER,
    EXTRACT(DOW FROM rp.payment_timestamp)::INTEGER,
    'completed',
    NOW()
  FROM recent_payments rp;
  
  -- Get count of processed records
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Get sample results for verification
  SELECT json_agg(row_to_json(re.*)) INTO sample_results
  FROM (
    SELECT square_payment_id, venue, revenue_type, amount_cents, payment_date
    FROM revenue_events 
    ORDER BY processed_at DESC 
    LIMIT 5
  ) re;
  
  -- Return results
  RETURN json_build_object(
    'success', true,
    'processed_count', processed_count,
    'sample_results', sample_results,
    'message', 'Successfully mapped ' || processed_count || ' transactions to revenue_events with venue-based revenue types'
  );
END;
$$;;
