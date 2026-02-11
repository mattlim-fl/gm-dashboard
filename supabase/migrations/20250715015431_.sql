-- Add organisation endpoint to Xero API endpoints
WITH xero_provider AS (SELECT id FROM public.api_providers WHERE name = 'xero')
INSERT INTO public.api_endpoints (provider_id, endpoint_key, method, path, description) VALUES
((SELECT id FROM xero_provider), 'organisation', 'GET', '/api.xro/2.0/Organisation', 'Get organisation information');;
