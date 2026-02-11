-- Add Xero API provider and configuration
INSERT INTO public.api_providers (name, display_name, base_url, auth_type) VALUES
('xero', 'Xero', 'https://api.xero.com', 'oauth');

-- Insert Xero endpoints
WITH xero_provider AS (SELECT id FROM public.api_providers WHERE name = 'xero')
INSERT INTO public.api_endpoints (provider_id, endpoint_key, method, path, description) VALUES
((SELECT id FROM xero_provider), 'invoices', 'GET', '/api.xro/2.0/Invoices', 'List invoices'),
((SELECT id FROM xero_provider), 'contacts', 'GET', '/api.xro/2.0/Contacts', 'List contacts'),
((SELECT id FROM xero_provider), 'accounts', 'GET', '/api.xro/2.0/Accounts', 'List accounts'),
((SELECT id FROM xero_provider), 'items', 'GET', '/api.xro/2.0/Items', 'List items'),
((SELECT id FROM xero_provider), 'payments', 'GET', '/api.xro/2.0/Payments', 'List payments'),
((SELECT id FROM xero_provider), 'bank_transactions', 'GET', '/api.xro/2.0/BankTransactions', 'List bank transactions');

-- Insert Xero configuration
WITH xero_provider AS (SELECT id FROM public.api_providers WHERE name = 'xero')
INSERT INTO public.api_configurations (provider_id, environment, config_data, secret_keys) VALUES
((SELECT id FROM xero_provider), 'production', 
 '{"headers": {"Accept": "application/json", "Content-Type": "application/json"}, "rate_limit": {"requests_per_minute": 60}}',
 '{"client_id": "XERO_CLIENT_ID", "client_secret": "XERO_CLIENT_SECRET", "access_token": "XERO_ACCESS_TOKEN"}'
);;
