-- Fix existing venue mapping
UPDATE revenue_events 
SET venue = CASE 
  WHEN (
    SELECT raw_response->'card_details'->>'statement_description' 
    FROM square_payments_raw 
    WHERE square_payments_raw.square_payment_id = revenue_events.square_payment_id
  ) LIKE '%HIPPIE%' THEN 'hippie'
  WHEN (
    SELECT raw_response->'card_details'->>'statement_description' 
    FROM square_payments_raw 
    WHERE square_payments_raw.square_payment_id = revenue_events.square_payment_id
  ) LIKE '%MANOR%' THEN 'manor'
  ELSE 'hippie' -- Default to hippie since current data shows "HIPPIE BAR"
END
WHERE venue = 'default';

-- Create backfill tracking table
CREATE TABLE IF NOT EXISTS square_backfill_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  payments_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create function to get venue from payment data
CREATE OR REPLACE FUNCTION get_venue_from_payment(payment_data JSONB)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  statement_desc TEXT;
  location_id TEXT;
BEGIN
  -- Try statement description first
  statement_desc := payment_data->'card_details'->>'statement_description';
  
  IF statement_desc ILIKE '%HIPPIE%' THEN
    RETURN 'hippie';
  ELSIF statement_desc ILIKE '%MANOR%' THEN
    RETURN 'manor';
  END IF;
  
  -- Fallback to location ID mapping if we add more venues
  location_id := payment_data->>'location_id';
  
  CASE location_id
    WHEN 'LZJH98CYNZ8JF' THEN RETURN 'hippie';
    -- Add other location IDs here as needed
    ELSE RETURN 'hippie'; -- Default since current data is hippie
  END CASE;
END;
$$;

-- Create function to determine revenue type
CREATE OR REPLACE FUNCTION get_revenue_type_from_payment(payment_data JSONB)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  amount_cents INTEGER;
  amount_dollars NUMERIC;
BEGIN
  amount_cents := (payment_data->'amount_money'->>'amount')::INTEGER;
  amount_dollars := amount_cents / 100.0;
  
  -- Simple logic: door fees are typically smaller amounts
  IF amount_dollars >= 5 AND amount_dollars <= 25 THEN
    RETURN 'door';
  ELSE
    RETURN 'bar';
  END IF;
END;
$$;

-- Function to process a single payment into revenue_events
CREATE OR REPLACE FUNCTION process_payment_to_revenue(payment_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  payment_data JSONB;
  venue_name TEXT;
  revenue_type TEXT;
  amount_cents INTEGER;
  payment_timestamp TIMESTAMP WITH TIME ZONE;
  payment_hour INTEGER;
  payment_dow INTEGER;
BEGIN
  -- Get the raw payment data
  SELECT raw_response INTO payment_data
  FROM square_payments_raw 
  WHERE square_payment_id = payment_id;
  
  IF payment_data IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Only process completed payments
  IF payment_data->>'status' != 'COMPLETED' THEN
    RETURN FALSE;
  END IF;
  
  -- Extract data
  venue_name := get_venue_from_payment(payment_data);
  revenue_type := get_revenue_type_from_payment(payment_data);
  amount_cents := (payment_data->'amount_money'->>'amount')::INTEGER;
  payment_timestamp := (payment_data->>'created_at')::TIMESTAMP WITH TIME ZONE;
  payment_hour := EXTRACT(HOUR FROM payment_timestamp);
  payment_dow := EXTRACT(DOW FROM payment_timestamp);
  
  -- Insert or update revenue event
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
  ) VALUES (
    payment_id,
    venue_name,
    revenue_type,
    amount_cents,
    payment_data->'amount_money'->>'currency',
    payment_timestamp,
    payment_hour,
    payment_dow,
    'completed',
    NOW()
  )
  ON CONFLICT (square_payment_id) 
  DO UPDATE SET
    venue = EXCLUDED.venue,
    revenue_type = EXCLUDED.revenue_type,
    amount_cents = EXCLUDED.amount_cents,
    payment_date = EXCLUDED.payment_date,
    payment_hour = EXCLUDED.payment_hour,
    payment_day_of_week = EXCLUDED.payment_day_of_week,
    updated_at = NOW();
    
  RETURN TRUE;
END;
$$;;
