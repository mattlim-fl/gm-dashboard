-- 1) Add booking_source if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='booking_source'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN booking_source text DEFAULT 'website_direct';
  END IF;
END $$;

-- 2) Create email_events table for logging transactional emails
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','sent','failed')),
  error text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3) Helpful index for availability queries on bookings
CREATE INDEX IF NOT EXISTS bookings_availability_idx
  ON public.bookings (booking_date, venue, venue_area, start_time, end_time)
  WHERE status <> 'cancelled' AND booking_type = 'venue_hire';

COMMENT ON COLUMN public.bookings.booking_source IS 'Origin of booking: website_direct, gm_widget, admin, etc.';;
