CREATE TABLE IF NOT EXISTS public.square_location_sync_status (
  location_id TEXT PRIMARY KEY REFERENCES public.square_locations(square_location_id),
  last_payment_created_at_seen TIMESTAMP WITH TIME ZONE,
  last_order_updated_at_seen TIMESTAMP WITH TIME ZONE,
  last_successful_sync_at TIMESTAMP WITH TIME ZONE,
  in_progress BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  payments_fetched INTEGER DEFAULT 0,
  payments_upserted INTEGER DEFAULT 0,
  orders_fetched INTEGER DEFAULT 0,
  orders_upserted INTEGER DEFAULT 0,
  errors TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loc_sync_status_in_progress ON public.square_location_sync_status(in_progress);
CREATE INDEX IF NOT EXISTS idx_loc_sync_status_last_heartbeat ON public.square_location_sync_status(last_heartbeat);
;
