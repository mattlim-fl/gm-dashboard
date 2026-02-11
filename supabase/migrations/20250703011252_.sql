-- Create table to store Square locations for venue mapping
CREATE TABLE public.square_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  square_location_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,
  address TEXT,
  business_name TEXT,
  country TEXT,
  currency TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.square_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for square_locations
CREATE POLICY "Staff can view all locations" 
ON public.square_locations 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can insert locations" 
ON public.square_locations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff can update locations" 
ON public.square_locations 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_square_locations_updated_at
BEFORE UPDATE ON public.square_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update the venue mapping function to use the locations table
CREATE OR REPLACE FUNCTION public.get_venue_from_payment(payment_data jsonb)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  location_id TEXT;
  venue_name TEXT;
BEGIN
  -- Get location_id from payment
  location_id := payment_data->>'location_id';
  
  -- Look up venue name from square_locations table
  SELECT location_name INTO venue_name
  FROM square_locations 
  WHERE square_location_id = location_id 
  AND is_active = true;
  
  -- Return the mapped venue name, or default to 'default'
  RETURN COALESCE(venue_name, 'default');
END;
$function$;;
