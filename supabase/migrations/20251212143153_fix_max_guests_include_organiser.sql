-- Fix max_guests calculation to include organiser (+1)
-- When an organiser exists, the capacity is ticket_quantity + 1

DROP FUNCTION IF EXISTS public.get_booking_guests(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_booking_guests(
  p_booking_id UUID,
  p_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  max_guests INTEGER,
  guests JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN := auth.uid() IS NOT NULL;
  v_ticket_quantity INTEGER;
  v_has_organiser BOOLEAN;
  v_max_guests INTEGER;
BEGIN
  -- Authorisation: staff can bypass token; customers must provide valid token
  IF NOT v_is_staff THEN
    PERFORM public.validate_guest_list_token(p_booking_id, p_token);
  END IF;

  -- Get ticket quantity from booking
  SELECT
    COALESCE(b.ticket_quantity, b.guest_count, 0)
  INTO v_ticket_quantity
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_ticket_quantity IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check if organiser exists
  SELECT EXISTS(
    SELECT 1 FROM public.booking_guests 
    WHERE booking_id = p_booking_id AND is_organiser = TRUE
  ) INTO v_has_organiser;

  -- Max guests = ticket_quantity + 1 (for organiser) if organiser exists
  -- Otherwise just ticket_quantity (legacy bookings)
  IF v_has_organiser THEN
    v_max_guests := v_ticket_quantity + 1;
  ELSE
    v_max_guests := v_ticket_quantity;
  END IF;

  RETURN QUERY
  SELECT
    v_max_guests AS max_guests,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'guest_name', g.guest_name,
          'is_organiser', g.is_organiser
        ) ORDER BY g.is_organiser DESC, g.created_at
      )
       FROM public.booking_guests g
       WHERE g.booking_id = p_booking_id),
      '[]'::JSONB
    ) AS guests;
END;
$$;

-- Also update upsert function to use the same logic
DROP FUNCTION IF EXISTS public.upsert_booking_guests(UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_booking_guests(
  p_booking_id UUID,
  p_guests JSONB,
  p_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  max_guests INTEGER,
  guests JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN := auth.uid() IS NOT NULL;
  v_ticket_quantity INTEGER;
  v_has_organiser BOOLEAN;
  v_max_guests INTEGER;
  v_guest_count INTEGER;
  v_organiser_name TEXT;
  v_organiser_exists BOOLEAN;
  v_new_organiser_name TEXT;
BEGIN
  -- Authorisation: staff can bypass token; customers must provide valid token
  IF NOT v_is_staff THEN
    PERFORM public.validate_guest_list_token(p_booking_id, p_token);
  END IF;

  -- Get ticket quantity
  SELECT
    COALESCE(b.ticket_quantity, b.guest_count, 0)
  INTO v_ticket_quantity
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_ticket_quantity IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check if organiser exists
  SELECT guest_name, TRUE INTO v_organiser_name, v_organiser_exists
  FROM public.booking_guests
  WHERE booking_id = p_booking_id AND is_organiser = TRUE;

  -- Calculate max guests (ticket_quantity + 1 if organiser exists)
  IF v_organiser_exists THEN
    v_max_guests := v_ticket_quantity + 1;
  ELSE
    v_max_guests := v_ticket_quantity;
  END IF;

  -- Count non-empty guest entries
  v_guest_count := (
    SELECT COUNT(*)
    FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS elem
    WHERE trim(elem->>'guest_name') <> ''
  );
  
  IF v_guest_count > v_max_guests THEN
    RAISE EXCEPTION 'Too many guests for booking (max %, got %)', v_max_guests, v_guest_count;
  END IF;

  -- Find organiser name in the input (if provided)
  SELECT elem->>'guest_name' INTO v_new_organiser_name
  FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS elem
  WHERE (elem->>'is_organiser')::BOOLEAN = TRUE
  LIMIT 1;

  -- If organiser exists, ensure they remain (cannot be removed)
  IF v_organiser_exists THEN
    -- Update organiser name if provided in input, otherwise keep existing
    IF v_new_organiser_name IS NOT NULL AND trim(v_new_organiser_name) <> '' THEN
      UPDATE public.booking_guests
      SET guest_name = trim(v_new_organiser_name), updated_at = now()
      WHERE booking_id = p_booking_id AND is_organiser = TRUE;
    END IF;
    
    -- Delete non-organiser guests only
    DELETE FROM public.booking_guests
    WHERE booking_id = p_booking_id AND is_organiser = FALSE;
  ELSE
    -- No organiser exists - delete all (legacy behavior)
    DELETE FROM public.booking_guests
    WHERE booking_id = p_booking_id;
  END IF;

  -- Insert non-organiser guests from input
  INSERT INTO public.booking_guests (booking_id, guest_name, is_organiser)
  SELECT
    p_booking_id,
    trim(elem->>'guest_name'),
    FALSE
  FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS elem
  WHERE trim(elem->>'guest_name') <> ''
    AND COALESCE((elem->>'is_organiser')::BOOLEAN, FALSE) = FALSE;

  -- Return updated list
  RETURN QUERY
  SELECT * FROM public.get_booking_guests(p_booking_id, p_token);
END;
$$;;
