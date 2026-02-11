-- Fix overnight karaoke booking validation (e.g. 23:00-00:00 slots)
-- The previous trigger incorrectly rejected valid overnight bookings

CREATE OR REPLACE FUNCTION public.validate_karaoke_hold_conflict()
RETURNS TRIGGER AS $$
DECLARE
  _now TIMESTAMP WITH TIME ZONE := now();
  _start_mins INT;
  _end_mins INT;
  _duration_mins INT;
BEGIN
  -- Convert times to minutes for easier comparison
  _start_mins := EXTRACT(HOUR FROM NEW.start_time) * 60 + EXTRACT(MINUTE FROM NEW.start_time);
  _end_mins := EXTRACT(HOUR FROM NEW.end_time) * 60 + EXTRACT(MINUTE FROM NEW.end_time);
  
  -- Calculate duration, handling overnight (end_time < start_time means wraps past midnight)
  IF _end_mins <= _start_mins THEN
    -- Overnight booking: e.g. 23:00-00:00 or 23:00-01:00
    _duration_mins := (24 * 60 - _start_mins) + _end_mins;
  ELSE
    _duration_mins := _end_mins - _start_mins;
  END IF;
  
  -- Validate duration is reasonable (1-120 minutes for karaoke)
  IF _duration_mins <= 0 OR _duration_mins > 120 THEN
    RAISE EXCEPTION 'Invalid session duration: must be between 1 minute and 2 hours';
  END IF;

  -- Only enforce conflicts when the hold is active and not already expired
  IF NEW.status = 'active' AND NEW.expires_at > _now THEN
    -- Conflict with existing active, non-expired holds on same booth/date
    -- For overnight bookings, we need to check if time ranges overlap correctly
    IF EXISTS (
      SELECT 1 FROM public.karaoke_booth_holds h
      WHERE h.booth_id = NEW.booth_id
        AND h.booking_date = NEW.booking_date
        AND h.status = 'active'
        AND h.expires_at > _now
        AND h.id IS DISTINCT FROM NEW.id
        AND (
          -- Standard overlap check works for non-overnight cases
          -- For overnight we need special handling
          CASE 
            WHEN NEW.end_time <= NEW.start_time THEN
              -- New booking is overnight: it covers start_time to midnight and midnight to end_time
              -- Overlaps if existing touches either range
              (h.start_time < '24:00'::time AND h.start_time >= NEW.start_time)
              OR (h.end_time > '00:00'::time AND h.end_time <= NEW.end_time)
              OR (h.start_time < NEW.end_time)
              OR (h.end_time > NEW.start_time AND h.end_time <= '24:00'::time)
            WHEN h.end_time <= h.start_time THEN
              -- Existing booking is overnight
              (NEW.start_time >= h.start_time)
              OR (NEW.end_time <= h.end_time)
              OR (NEW.start_time < h.end_time)
            ELSE
              -- Neither is overnight: standard overlap
              (NEW.start_time < h.end_time AND NEW.end_time > h.start_time)
          END
        )
    ) THEN
      RAISE EXCEPTION 'Another active hold exists for this booth and time range';
    END IF;

    -- Conflict with existing bookings (anything not cancelled)
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.karaoke_booth_id = NEW.booth_id
        AND b.booking_date = NEW.booking_date
        AND b.status != 'cancelled'
        AND (
          CASE 
            WHEN NEW.end_time <= NEW.start_time THEN
              -- New hold is overnight
              (b.start_time >= NEW.start_time)
              OR (b.end_time <= NEW.end_time AND b.end_time > '00:00'::time)
              OR (b.start_time < NEW.end_time)
            WHEN b.end_time IS NOT NULL AND b.end_time <= b.start_time THEN
              -- Existing booking is overnight
              (NEW.start_time >= b.start_time)
              OR (NEW.end_time <= b.end_time)
              OR (NEW.start_time < b.end_time)
            ELSE
              -- Neither is overnight: standard overlap
              (NEW.start_time < b.end_time AND NEW.end_time > b.start_time)
          END
        )
    ) THEN
      RAISE EXCEPTION 'An existing booking conflicts with this booth and time range';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;;
