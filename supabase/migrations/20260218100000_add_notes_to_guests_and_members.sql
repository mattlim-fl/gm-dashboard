-- Add notes column to members table (persistent across all events)
ALTER TABLE members ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add notes column to booking_guests table (event-specific)
ALTER TABLE booking_guests ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN members.notes IS 'Persistent notes about this member (e.g., bar card privileges, VIP treatment)';
COMMENT ON COLUMN booking_guests.notes IS 'Event-specific notes for this guest on this booking';
