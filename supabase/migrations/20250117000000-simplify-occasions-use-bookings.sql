-- Drop the occasions table (we'll use bookings instead)
DROP TABLE IF EXISTS occasions CASCADE;

-- Add occasion-related fields to bookings table
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS occasion_name TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS organiser_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_occasion_organiser BOOLEAN DEFAULT false;

-- Remove the occasion_id foreign key we added earlier
ALTER TABLE bookings DROP COLUMN IF EXISTS occasion_id;

-- Update booking_type constraint to include 'occasion'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check 
  CHECK (booking_type IN ('venue_hire', 'vip_tickets', 'karaoke_booking', 'occasion'));

-- Create index for organiser token lookups
CREATE INDEX IF NOT EXISTS idx_bookings_organiser_token ON bookings(organiser_token);

-- Add comments
COMMENT ON COLUMN bookings.occasion_name IS 'Name of the occasion (e.g., "Sarah''s Birthday") - only for occasion bookings';
COMMENT ON COLUMN bookings.capacity IS 'Total capacity for occasion - only for organiser bookings';
COMMENT ON COLUMN bookings.organiser_token IS 'Token for organiser to access their occasion page';
COMMENT ON COLUMN bookings.is_occasion_organiser IS 'True if this is the organiser/parent booking for an occasion';
