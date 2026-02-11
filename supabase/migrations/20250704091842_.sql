-- Update get_revenue_type_from_payment to use venue-based mapping
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

-- Update test_map_100_transactions to use venue-based revenue type mapping
CREATE OR REPLACE FUNCTION public.test_map_100_transactions()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  processed_count INTEGER := 0;
  sample_results JSON;
BEGIN
  -- Insert 100 recent transactions from raw payments to revenue_events
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
    LIMIT 100
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
    get_revenue_type_from_payment(rp.raw_response) as revenue_type, -- Use venue-based mapping
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
$$;

-- Update process_payments_batch to use venue-based revenue type mapping
CREATE OR REPLACE FUNCTION public.process_payments_batch(
  payment_ids TEXT[] DEFAULT NULL,
  days_back INTEGER DEFAULT 14
)
RETURNS TABLE(
  processed_count INTEGER,
  error_count INTEGER,
  total_payments INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INTEGER := 0;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate cutoff date if using days_back filter
  IF payment_ids IS NULL THEN
    cutoff_date := NOW() - (days_back || ' days')::INTERVAL;
  END IF;
  
  -- Insert/update revenue events in batch
  WITH payment_data AS (
    SELECT 
      spr.square_payment_id,
      spr.raw_response,
      -- Extract venue from location_id mapping
      COALESCE(sl.location_name, 'default') as venue_name,
      -- Extract payment details
      (spr.raw_response->>'created_at')::TIMESTAMP WITH TIME ZONE as payment_timestamp,
      (spr.raw_response->'amount_money'->>'amount')::INTEGER as amount_cents,
      COALESCE(spr.raw_response->'amount_money'->>'currency', 'USD') as currency,
      COALESCE(spr.raw_response->>'status', 'COMPLETED') as payment_status
    FROM square_payments_raw spr
    LEFT JOIN square_locations sl ON sl.square_location_id = spr.raw_response->>'location_id'
    WHERE 
      -- Filter by payment IDs if provided
      (payment_ids IS NULL OR spr.square_payment_id = ANY(payment_ids))
      -- Or filter by date range
      AND (payment_ids IS NOT NULL OR (spr.raw_response->>'created_at')::TIMESTAMP WITH TIME ZONE >= cutoff_date)
      -- Only process completed payments
      AND COALESCE(spr.raw_response->>'status', 'COMPLETED') = 'COMPLETED'
  ),
  insert_results AS (
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
      pd.square_payment_id,
      pd.venue_name,
      -- Use venue-based revenue type mapping
      CASE pd.venue_name
        WHEN 'Hippie Door' THEN 'door'
        WHEN 'Hippie Bar' THEN 'bar'
        WHEN 'Manor Bar' THEN 'bar'
        ELSE 'bar'  -- Default fallback
      END as revenue_type,
      pd.amount_cents,
      pd.currency,
      pd.payment_timestamp,
      EXTRACT(HOUR FROM pd.payment_timestamp)::INTEGER,
      EXTRACT(DOW FROM pd.payment_timestamp)::INTEGER,
      'completed',
      NOW()
    FROM payment_data pd
    ON CONFLICT (square_payment_id) 
    DO UPDATE SET
      venue = EXCLUDED.venue,
      revenue_type = EXCLUDED.revenue_type,
      amount_cents = EXCLUDED.amount_cents,
      payment_date = EXCLUDED.payment_date,
      payment_hour = EXCLUDED.payment_hour,
      payment_day_of_week = EXCLUDED.payment_day_of_week,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT 
    COUNT(*) as total_from_raw,
    COUNT(ir.*) as processed_from_insert
  INTO total_count, processed_count
  FROM payment_data pd
  LEFT JOIN insert_results ir ON true;
  
  -- Error count is difference between total and processed
  error_count := total_count - processed_count;
  
  RETURN QUERY SELECT processed_count, error_count, total_count;
END;
$$;;
