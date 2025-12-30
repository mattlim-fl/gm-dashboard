-- Add is_organiser column to booking_guests table
-- This marks the booking organiser's entry in the guest list

ALTER TABLE public.booking_guests 
ADD COLUMN is_organiser BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for quick lookups of organiser entries
CREATE INDEX idx_bg_is_organiser ON public.booking_guests(booking_id) WHERE is_organiser = TRUE;

-- Add constraint: only one organiser per booking
CREATE UNIQUE INDEX idx_bg_one_organiser_per_booking 
ON public.booking_guests(booking_id) 
WHERE is_organiser = TRUE;











