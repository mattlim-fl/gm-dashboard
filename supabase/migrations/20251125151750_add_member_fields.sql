-- Add member fields to customers table
ALTER TABLE public.customers
ADD COLUMN is_member BOOLEAN DEFAULT FALSE,
ADD COLUMN notes TEXT;

-- Create index for member lookups
CREATE INDEX idx_customers_is_member ON public.customers(is_member) WHERE is_member = TRUE;
;
