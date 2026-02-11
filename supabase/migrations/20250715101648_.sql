-- Add missing sync tracking columns for Xero
CREATE TABLE IF NOT EXISTS public.xero_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment TEXT NOT NULL DEFAULT 'production',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  last_successful_sync TIMESTAMP WITH TIME ZONE,
  accounts_synced INTEGER DEFAULT 0,
  reports_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.xero_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view xero sync status" 
ON public.xero_sync_status 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert xero sync status" 
ON public.xero_sync_status 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update xero sync status" 
ON public.xero_sync_status 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);;
