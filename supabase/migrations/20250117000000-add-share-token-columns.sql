-- Add shareable token for organisers
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Add parent reference for guest purchases
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_share_token ON bookings(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_parent_booking_id ON bookings(parent_booking_id) WHERE parent_booking_id IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN bookings.share_token IS 'Unique shareable token for group ticket purchases (e.g., ABC123XYZ)';
COMMENT ON COLUMN bookings.parent_booking_id IS 'Reference to organiser booking for guest ticket purchases';



