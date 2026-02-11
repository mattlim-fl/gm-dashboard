
-- Create table for storing raw Square API responses
CREATE TABLE public.square_payments_raw (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  square_payment_id TEXT NOT NULL UNIQUE,
  raw_response JSONB NOT NULL,
  api_version TEXT,
  sync_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for transformed revenue events
CREATE TABLE public.revenue_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  square_payment_id TEXT NOT NULL REFERENCES square_payments_raw(square_payment_id),
  venue TEXT NOT NULL,
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('bar', 'door', 'other')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_hour INTEGER NOT NULL CHECK (payment_hour >= 0 AND payment_hour <= 23),
  payment_day_of_week INTEGER NOT NULL CHECK (payment_day_of_week >= 0 AND payment_day_of_week <= 6),
  status TEXT NOT NULL DEFAULT 'completed',
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking sync status and health
CREATE TABLE public.square_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  last_successful_sync TIMESTAMP WITH TIME ZONE,
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'running', 'success', 'error')),
  error_message TEXT,
  payments_synced INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_square_payments_raw_sync_timestamp ON square_payments_raw(sync_timestamp);
CREATE INDEX idx_square_payments_raw_square_id ON square_payments_raw(square_payment_id);
CREATE INDEX idx_revenue_events_payment_date ON revenue_events(payment_date);
CREATE INDEX idx_revenue_events_venue ON revenue_events(venue);
CREATE INDEX idx_revenue_events_revenue_type ON revenue_events(revenue_type);
CREATE INDEX idx_revenue_events_payment_hour ON revenue_events(payment_hour);
CREATE INDEX idx_square_sync_status_environment ON square_sync_status(environment);

-- Add trigger for updated_at timestamps
CREATE TRIGGER update_revenue_events_updated_at
  BEFORE UPDATE ON revenue_events
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_square_sync_status_updated_at
  BEFORE UPDATE ON square_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insert initial sync status records for both environments
INSERT INTO square_sync_status (environment, sync_status) 
VALUES 
  ('sandbox', 'pending'),
  ('production', 'pending');
;
