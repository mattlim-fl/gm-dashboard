-- Create OAuth tokens storage table
CREATE TABLE public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'production',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  tenant_id TEXT, -- For Xero tenant/organization ID
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider_name, user_id, environment, tenant_id)
);

-- Enable RLS
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for OAuth tokens
CREATE POLICY "Users can manage their own OAuth tokens" 
ON public.oauth_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE TRIGGER update_oauth_tokens_updated_at
BEFORE UPDATE ON public.oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update Xero configuration to use OAuth flow
UPDATE public.api_configurations 
SET secret_keys = '{"client_id": "XERO_CLIENT_ID", "client_secret": "XERO_CLIENT_SECRET"}'::jsonb
WHERE provider_id = (SELECT id FROM public.api_providers WHERE name = 'xero');;
