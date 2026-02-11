-- Add reference_code column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reference_code text;

-- Create a unique index on reference_code to ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS bookings_reference_code_idx 
ON public.bookings (reference_code) 
WHERE reference_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.reference_code IS 'User-friendly reference code for bookings (format: MAN-YY-XXXXXX)';;
