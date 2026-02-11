
-- Create table for storing global feature flag defaults
CREATE TABLE public.feature_flag_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.feature_flag_defaults ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to read global defaults
CREATE POLICY "Authenticated users can view global feature flag defaults" 
  ON public.feature_flag_defaults 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Policy to allow authenticated users to update global defaults
-- (You can later restrict this to admin users only if needed)
CREATE POLICY "Authenticated users can update global feature flag defaults" 
  ON public.feature_flag_defaults 
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow authenticated users to insert new global defaults
CREATE POLICY "Authenticated users can insert global feature flag defaults" 
  ON public.feature_flag_defaults 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_feature_flag_defaults_updated_at
  BEFORE UPDATE ON feature_flag_defaults
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Seed the table with current hardcoded defaults
INSERT INTO public.feature_flag_defaults (flag_key, enabled) VALUES
  ('showCalendar', true),
  ('showBookings', true),
  ('showCustomers', true),
  ('showRevenue', true),
  ('showDeveloperTools', true),
  ('showSettings', true),
  ('newRevenueCharts', false),
  ('enhancedCustomerView', false),
  ('betaBookingFlow', false),
  ('debugMode', false);
;
