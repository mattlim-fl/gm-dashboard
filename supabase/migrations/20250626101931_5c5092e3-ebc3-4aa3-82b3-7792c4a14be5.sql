
-- Fix the revenue_events table by adding a unique constraint on square_payment_id
-- This will allow the upsert operation to work properly
ALTER TABLE public.revenue_events ADD CONSTRAINT revenue_events_square_payment_id_unique UNIQUE (square_payment_id);

-- Also add an index for better performance on the foreign key reference
CREATE INDEX IF NOT EXISTS idx_revenue_events_square_payment_id ON public.revenue_events(square_payment_id);
;
