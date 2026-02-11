-- Add ticket pricing column to track unit price per ticket
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_price_cents INTEGER;

-- Add guest list token for customer self-service access
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_list_token TEXT;

-- Add comment for clarity
COMMENT ON COLUMN bookings.ticket_price_cents IS 'Unit price per ticket in cents (e.g., 1000 = $10)';
COMMENT ON COLUMN bookings.guest_list_token IS 'Signed HMAC token for customer guest list access';;
