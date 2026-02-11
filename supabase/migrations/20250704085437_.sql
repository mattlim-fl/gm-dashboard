-- Create optimized batch processing function for venue mapping
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
      'bar' as revenue_type, -- Default for now, will be enhanced later
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
$$;

-- Create a simpler wrapper function for the edge function to call
CREATE OR REPLACE FUNCTION public.reprocess_venues_batch(days_back INTEGER DEFAULT 14)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result RECORD;
  response JSON;
BEGIN
  -- Call the batch processing function
  SELECT * INTO result FROM process_payments_batch(NULL, days_back);
  
  -- Return JSON response
  response := json_build_object(
    'success', true,
    'processed_count', result.processed_count,
    'error_count', result.error_count,
    'total_payments', result.total_payments
  );
  
  RETURN response;
END;
$$;;
