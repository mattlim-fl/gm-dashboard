-- Function to upsert customer from booking data
CREATE OR REPLACE FUNCTION sync_customer_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create/update customer if we have at least name and (email or phone)
  IF NEW.customer_name IS NOT NULL AND (NEW.customer_email IS NOT NULL OR NEW.customer_phone IS NOT NULL) THEN
    INSERT INTO public.customers (name, email, phone, updated_at)
    VALUES (
      NEW.customer_name,
      NEW.customer_email,
      NEW.customer_phone,
      NOW()
    )
    ON CONFLICT DO NOTHING;
    
    -- If customer exists, update their info (prefer email/phone from booking if provided)
    UPDATE public.customers
    SET 
      name = COALESCE(NEW.customer_name, name),
      email = COALESCE(NULLIF(NEW.customer_email, ''), email),
      phone = COALESCE(NULLIF(NEW.customer_phone, ''), phone),
      updated_at = NOW()
    WHERE 
      (email IS NOT NULL AND email = NEW.customer_email AND NEW.customer_email IS NOT NULL)
      OR (phone IS NOT NULL AND phone = NEW.customer_phone AND NEW.customer_phone IS NOT NULL)
      OR (name = NEW.customer_name AND email IS NULL AND phone IS NULL AND NEW.customer_email IS NULL AND NEW.customer_phone IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync customers when bookings are created or updated
DROP TRIGGER IF EXISTS trigger_sync_customer_from_booking ON public.bookings;
CREATE TRIGGER trigger_sync_customer_from_booking
  AFTER INSERT OR UPDATE OF customer_name, customer_email, customer_phone
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_from_booking();

-- Backfill: Create customers from existing bookings
INSERT INTO public.customers (name, email, phone, created_at, updated_at)
SELECT DISTINCT ON (
  COALESCE(customer_email, ''),
  COALESCE(customer_phone, ''),
  customer_name
)
  customer_name as name,
  NULLIF(customer_email, '') as email,
  NULLIF(customer_phone, '') as phone,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM public.bookings
WHERE customer_name IS NOT NULL
  AND (customer_email IS NOT NULL OR customer_phone IS NOT NULL)
GROUP BY customer_name, customer_email, customer_phone
ON CONFLICT DO NOTHING;

-- Create index for member lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_customers_is_member ON public.customers(is_member) WHERE is_member = TRUE;
;
