-- Support bookings/holds that cross midnight (e.g. 23:00 -> 00:00)
-- We interpret end_time <= start_time as "end time is on the next day".

-- 1) Holds: allow overnight ranges and detect conflicts across adjacent dates
CREATE OR REPLACE FUNCTION public.validate_karaoke_hold_conflict()
RETURNS TRIGGER AS $$
DECLARE
  _now TIMESTAMP WITH TIME ZONE := now();
  new_start_ts TIMESTAMP := (NEW.booking_date::timestamp + NEW.start_time);
  new_end_ts   TIMESTAMP := (NEW.booking_date::timestamp + NEW.end_time);
BEGIN
  -- Disallow zero-length ranges
  IF NEW.end_time = NEW.start_time THEN
    RAISE EXCEPTION 'end_time must be different from start_time';
  END IF;

  -- Overnight ranges roll into the next day
  IF NEW.end_time <= NEW.start_time THEN
    new_end_ts := new_end_ts + interval '1 day';
  END IF;

  -- Only enforce when the hold is active and not already expired
  IF NEW.status = 'active' AND NEW.expires_at > _now THEN
    -- Conflict with existing active, non-expired holds for this booth (check adjacent dates for overnight spans)
    IF EXISTS (
      SELECT 1
      FROM public.karaoke_booth_holds h
      WHERE h.booth_id = NEW.booth_id
        AND h.booking_date BETWEEN (NEW.booking_date - 1) AND (NEW.booking_date + 1)
        AND h.status = 'active'
        AND h.expires_at > _now
        AND h.id IS DISTINCT FROM NEW.id
        AND (
          new_start_ts
            < (h.booking_date::timestamp + h.end_time + CASE WHEN h.end_time <= h.start_time THEN interval '1 day' ELSE interval '0' END)
          AND
          new_end_ts
            > (h.booking_date::timestamp + h.start_time)
        )
    ) THEN
      RAISE EXCEPTION 'Another active hold exists for this booth and time range';
    END IF;

    -- Conflict with existing bookings (anything not cancelled) for this booth (check adjacent dates for overnight spans)
    IF EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.karaoke_booth_id = NEW.booth_id
        AND b.booking_date BETWEEN (NEW.booking_date - 1) AND (NEW.booking_date + 1)
        AND b.status != 'cancelled'
        AND (
          new_start_ts
            < (b.booking_date::timestamp + b.end_time + CASE WHEN b.end_time <= b.start_time THEN interval '1 day' ELSE interval '0' END)
          AND
          new_end_ts
            > (b.booking_date::timestamp + b.start_time)
        )
    ) THEN
      RAISE EXCEPTION 'An existing booking conflicts with this booth and time range';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Bookings: detect overlaps across adjacent dates and allow overnight end_time
CREATE OR REPLACE FUNCTION public.validate_karaoke_booking_conflict()
RETURNS TRIGGER AS $$
DECLARE
  new_start_ts TIMESTAMP;
  new_end_ts   TIMESTAMP;
BEGIN
  -- Only validate karaoke bookings
  IF NEW.booking_type = 'karaoke_booking' AND NEW.karaoke_booth_id IS NOT NULL THEN
    -- Disallow zero-length ranges
    IF NEW.end_time = NEW.start_time THEN
      RAISE EXCEPTION 'End time must be different from start time';
    END IF;

    new_start_ts := (NEW.booking_date::timestamp + NEW.start_time);
    new_end_ts := (NEW.booking_date::timestamp + NEW.end_time);
    IF NEW.end_time <= NEW.start_time THEN
      new_end_ts := new_end_ts + interval '1 day';
    END IF;

    -- Check for overlapping bookings on the same booth across adjacent dates (overnight)
    IF EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.karaoke_booth_id = NEW.karaoke_booth_id
        AND b.booking_date BETWEEN (NEW.booking_date - 1) AND (NEW.booking_date + 1)
        AND b.status != 'cancelled'
        AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND (
          new_start_ts
            < (b.booking_date::timestamp + b.end_time + CASE WHEN b.end_time <= b.start_time THEN interval '1 day' ELSE interval '0' END)
          AND
          new_end_ts
            > (b.booking_date::timestamp + b.start_time)
        )
    ) THEN
      RAISE EXCEPTION 'Karaoke booth is already booked for this time slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Helper availability function: consider overnight bookings and adjacent dates
CREATE OR REPLACE FUNCTION public.get_karaoke_booth_availability(
  booth_id UUID,
  booking_date DATE,
  start_time TIME,
  end_time TIME,
  exclude_booking_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  start_ts TIMESTAMP;
  end_ts   TIMESTAMP;
BEGIN
  -- Check if booth exists and is available
  IF NOT EXISTS (
    SELECT 1 FROM public.karaoke_booths
    WHERE id = booth_id AND is_available = true
  ) THEN
    RETURN false;
  END IF;

  -- Disallow zero-length ranges
  IF end_time = start_time THEN
    RETURN false;
  END IF;

  start_ts := (booking_date::timestamp + start_time);
  end_ts := (booking_date::timestamp + end_time);
  IF end_time <= start_time THEN
    end_ts := end_ts + interval '1 day';
  END IF;

  -- Check for conflicting bookings (adjacent dates for overnight)
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.karaoke_booth_id = booth_id
      AND b.booking_date BETWEEN (booking_date - 1) AND (booking_date + 1)
      AND b.status != 'cancelled'
      AND (exclude_booking_id IS NULL OR b.id != exclude_booking_id)
      AND (
        start_ts
          < (b.booking_date::timestamp + b.end_time + CASE WHEN b.end_time <= b.start_time THEN interval '1 day' ELSE interval '0' END)
        AND
        end_ts
          > (b.booking_date::timestamp + b.start_time)
      )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;












