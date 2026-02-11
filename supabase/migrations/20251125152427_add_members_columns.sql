-- Add is_member and notes columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;
;
