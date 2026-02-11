-- Create API providers table for managing different API integrations
CREATE TABLE public.api_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'square', 'xero', etc.
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('bearer', 'oauth', 'api_key', 'basic')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create API endpoints table for defining available endpoints per provider
CREATE TABLE public.api_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES public.api_providers(id) ON DELETE CASCADE,
  endpoint_key TEXT NOT NULL, -- 'payments', 'locations', 'invoices', etc.
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  path TEXT NOT NULL, -- '/v2/payments', '/api/invoices', etc.
  description TEXT,
  response_mapper TEXT, -- function name for transforming responses
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(provider_id, endpoint_key)
);

-- Create API configurations for environment-specific settings
CREATE TABLE public.api_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES public.api_providers(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  config_data JSONB NOT NULL, -- stores headers, rate limits, special params, etc.
  secret_keys JSONB, -- references to Supabase secrets (not actual values)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(provider_id, environment)
);

-- Enable RLS on all tables
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_configurations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff access
CREATE POLICY "Staff can view all API providers" 
  ON public.api_providers FOR SELECT USING (true);
CREATE POLICY "Staff can manage API providers" 
  ON public.api_providers FOR ALL USING (true);

CREATE POLICY "Staff can view all API endpoints" 
  ON public.api_endpoints FOR SELECT USING (true);
CREATE POLICY "Staff can manage API endpoints" 
  ON public.api_endpoints FOR ALL USING (true);

CREATE POLICY "Staff can view all API configurations" 
  ON public.api_configurations FOR SELECT USING (true);
CREATE POLICY "Staff can manage API configurations" 
  ON public.api_configurations FOR ALL USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_api_providers_updated_at
  BEFORE UPDATE ON public.api_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_endpoints_updated_at
  BEFORE UPDATE ON public.api_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_configurations_updated_at
  BEFORE UPDATE ON public.api_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial Square provider configuration
INSERT INTO public.api_providers (name, display_name, base_url, auth_type) VALUES
('square', 'Square', 'https://connect.squareup.com', 'bearer'),
('square_sandbox', 'Square Sandbox', 'https://connect.squareupsandbox.com', 'bearer');

-- Insert Square endpoints
WITH square_prod AS (SELECT id FROM public.api_providers WHERE name = 'square'),
     square_sandbox AS (SELECT id FROM public.api_providers WHERE name = 'square_sandbox')
INSERT INTO public.api_endpoints (provider_id, endpoint_key, method, path, description) VALUES
-- Square Production endpoints
((SELECT id FROM square_prod), 'locations', 'GET', '/v2/locations', 'List all locations'),
((SELECT id FROM square_prod), 'payments', 'GET', '/v2/payments', 'List payments with filters'),
((SELECT id FROM square_prod), 'orders', 'GET', '/v2/orders', 'List orders'),
-- Square Sandbox endpoints  
((SELECT id FROM square_sandbox), 'locations', 'GET', '/v2/locations', 'List all locations'),
((SELECT id FROM square_sandbox), 'payments', 'GET', '/v2/payments', 'List payments with filters'),
((SELECT id FROM square_sandbox), 'orders', 'GET', '/v2/orders', 'List orders');

-- Insert Square configurations
WITH square_prod AS (SELECT id FROM public.api_providers WHERE name = 'square'),
     square_sandbox AS (SELECT id FROM public.api_providers WHERE name = 'square_sandbox')
INSERT INTO public.api_configurations (provider_id, environment, config_data, secret_keys) VALUES
((SELECT id FROM square_prod), 'production', 
 '{"headers": {"Square-Version": "2024-12-18", "Content-Type": "application/json"}, "rate_limit": {"requests_per_minute": 500}}',
 '{"access_token": "SQUARE_PRODUCTION_ACCESS_TOKEN"}'),
((SELECT id FROM square_sandbox), 'sandbox', 
 '{"headers": {"Square-Version": "2024-12-18", "Content-Type": "application/json"}, "rate_limit": {"requests_per_minute": 500}}',
 '{"access_token": "SQUARE_SANDBOX_ACCESS_TOKEN"}');;
