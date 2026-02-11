-- Add archive fields to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for filtering non-archived customers
CREATE INDEX IF NOT EXISTS idx_customers_is_archived ON public.customers(is_archived) WHERE is_archived = FALSE;

-- Add comment explaining the archive functionality
COMMENT ON COLUMN public.customers.is_archived IS 'Soft delete flag - archived customers are hidden from normal views but bookings remain intact';
COMMENT ON COLUMN public.customers.archived_at IS 'Timestamp when customer was archived';;
