-- Rename karaoke_booking_guests to booking_guests (generic for all booking types)
-- Also rename associated RPC functions to generic names

-- 1. Rename the table
ALTER TABLE public.karaoke_booking_guests RENAME TO booking_guests;

-- 2. Rename the index
ALTER INDEX idx_kbg_booking RENAME TO idx_bg_booking;

-- 3. Rename the RLS policy
ALTER POLICY "Staff can manage karaoke_booking_guests" ON public.booking_guests
  RENAME TO "Staff can manage booking_guests";

-- 4. Rename the trigger
ALTER TRIGGER handle_karaoke_booking_guests_updated_at ON public.booking_guests
  RENAME TO handle_booking_guests_updated_at;

-- 5. Drop old functions and create new ones with generic names

-- Drop old functions (in reverse dependency order)
DROP FUNCTION IF EXISTS public.upsert_karaoke_guest_list(UUID, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.get_karaoke_guest_list(UUID, TEXT);
DROP FUNCTION IF EXISTS public.validate_karaoke_guest_token(UUID, TEXT);

-- Recreate validate function with new name
CREATE OR REPLACE FUNCTION public.validate_guest_list_token(p_booking_id UUID, p_token TEXT)
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

-- Recreate get function with new name
CREATE OR REPLACE FUNCTION public.get_booking_guests(
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
    PERFORM public.validate_guest_list_token(p_booking_id, p_token);
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
       FROM public.booking_guests g
       WHERE g.booking_id = p_booking_id),
      ARRAY[]::TEXT[]
    ) AS guests;
END;
$$;

-- Recreate upsert function with new name
CREATE OR REPLACE FUNCTION public.upsert_booking_guests(
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
    PERFORM public.validate_guest_list_token(p_booking_id, p_token);
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
  DELETE FROM public.booking_guests
  WHERE booking_id = p_booking_id;

  INSERT INTO public.booking_guests (booking_id, guest_name)
  SELECT
    p_booking_id,
    trim(g)
  FROM unnest(COALESCE(p_guests, ARRAY[]::TEXT[])) AS g
  WHERE trim(g) <> '';

  -- Return updated list
  RETURN QUERY
  SELECT * FROM public.get_booking_guests(p_booking_id, p_token);
END;
$$;












