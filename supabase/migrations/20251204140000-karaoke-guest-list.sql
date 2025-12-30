-- Karaoke guest list support for karaoke bookings
-- - Adds karaoke_booking_guests table
-- - Adds RPC helpers for fetching and updating guest lists
-- - Uses signed magic-link tokens for customer access

-- Ensure pgcrypto is available for HMAC support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table to store per-booking guest names
CREATE TABLE public.karaoke_booking_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kbg_booking ON public.karaoke_booking_guests(booking_id);

-- Enable RLS – access is via SECURITY DEFINER functions
ALTER TABLE public.karaoke_booking_guests ENABLE ROW LEVEL SECURITY;

-- Simple staff policy: authenticated users (staff) have full access
CREATE POLICY "Staff can manage karaoke_booking_guests"
ON public.karaoke_booking_guests
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- updated_at trigger
CREATE TRIGGER handle_karaoke_booking_guests_updated_at
  BEFORE UPDATE ON public.karaoke_booking_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Helper function to validate a magic-link token.
-- Token format: booking_id.expiry_epoch.signature
-- Signature: HMAC-SHA256(booking_id || expiry_epoch, secret)
CREATE OR REPLACE FUNCTION public.validate_karaoke_guest_token(p_booking_id UUID, p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret TEXT := 'guest-list-secret'; -- keep in sync with Edge Functions
  v_token_booking_id UUID;
  v_expiry BIGINT;
  v_sig TEXT;
  v_expected_sig TEXT;
  v_now BIGINT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Missing guest list token';
  END IF;

  BEGIN
    v_token_booking_id := split_part(p_token, '.', 1)::UUID;
    v_expiry := split_part(p_token, '.', 2)::BIGINT;
    v_sig := split_part(p_token, '.', 3);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid guest list token format';
  END;

  IF v_token_booking_id IS NULL OR v_sig IS NULL OR v_expiry IS NULL THEN
    RAISE EXCEPTION 'Invalid guest list token format';
  END IF;

  IF v_token_booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Guest list token does not match booking';
  END IF;

  v_now := extract(epoch FROM now())::BIGINT;
  IF v_expiry < v_now THEN
    RAISE EXCEPTION 'Guest list token has expired';
  END IF;

  v_expected_sig := encode(
    hmac(
      (v_token_booking_id::TEXT || v_expiry::TEXT)::BYTEA,
      v_secret::BYTEA,
      'sha256'
    ),
    'hex'
  );

  IF v_expected_sig <> v_sig THEN
    RAISE EXCEPTION 'Invalid guest list token signature';
  END IF;
END;
$$;

-- RPC: get_karaoke_guest_list
-- Returns max_guests (capacity) and current guest names as text[]
CREATE OR REPLACE FUNCTION public.get_karaoke_guest_list(
  p_booking_id UUID,
  p_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  max_guests INTEGER,
  guests TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN := auth.uid() IS NOT NULL;
  v_max_guests INTEGER;
BEGIN
  -- Authorisation: staff can bypass token; customers must provide valid token
  IF NOT v_is_staff THEN
    PERFORM public.validate_karaoke_guest_token(p_booking_id, p_token);
  END IF;

  SELECT
    COALESCE(b.ticket_quantity, b.guest_count, 0)
  INTO v_max_guests
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_max_guests IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  RETURN QUERY
  SELECT
    v_max_guests AS max_guests,
    COALESCE(
      (SELECT array_agg(g.guest_name ORDER BY g.created_at)
       FROM public.karaoke_booking_guests g
       WHERE g.booking_id = p_booking_id),
      ARRAY[]::TEXT[]
    ) AS guests;
END;
$$;

-- RPC: upsert_karaoke_guest_list
-- Replaces guest list for a booking with the provided array of names
CREATE OR REPLACE FUNCTION public.upsert_karaoke_guest_list(
  p_booking_id UUID,
  p_guests TEXT[],
  p_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  max_guests INTEGER,
  guests TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN := auth.uid() IS NOT NULL;
  v_max_guests INTEGER;
  v_guest_count INTEGER;
BEGIN
  -- Authorisation: staff can bypass token; customers must provide valid token
  IF NOT v_is_staff THEN
    PERFORM public.validate_karaoke_guest_token(p_booking_id, p_token);
  END IF;

  SELECT
    COALESCE(b.ticket_quantity, b.guest_count, 0)
  INTO v_max_guests
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_max_guests IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_guest_count := COALESCE(array_length(p_guests, 1), 0);
  IF v_guest_count > v_max_guests THEN
    RAISE EXCEPTION 'Too many guests for booking (max %, got %)', v_max_guests, v_guest_count;
  END IF;

  -- Replace current guest list
  DELETE FROM public.karaoke_booking_guests
  WHERE booking_id = p_booking_id;

  INSERT INTO public.karaoke_booking_guests (booking_id, guest_name)
  SELECT
    p_booking_id,
    trim(g)
  FROM unnest(COALESCE(p_guests, ARRAY[]::TEXT[])) AS g
  WHERE trim(g) <> '';

  -- Return updated list
  RETURN QUERY
  SELECT * FROM public.get_karaoke_guest_list(p_booking_id, p_token);
END;
$$;


















