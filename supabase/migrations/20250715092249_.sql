-- Create Xero accounts table
CREATE TABLE public.xero_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  xero_account_id TEXT NOT NULL UNIQUE,
  account_code TEXT,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_class TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  raw_response JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Xero profit and loss raw data table
CREATE TABLE public.xero_profit_loss_raw (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id TEXT NOT NULL,
  report_date DATE NOT NULL,
  raw_response JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(report_id, report_date)
);

-- Create normalized profit and loss events table
CREATE TABLE public.profit_loss_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  category TEXT NOT NULL, -- revenue, cost_of_sales, operating_expenses
  subcategory TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_date DATE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.xero_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_profit_loss_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_loss_events ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies for authenticated users
CREATE POLICY "Authenticated users can view xero accounts" 
ON public.xero_accounts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert xero accounts" 
ON public.xero_accounts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update xero accounts" 
ON public.xero_accounts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view profit loss raw data" 
ON public.xero_profit_loss_raw 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert profit loss raw data" 
ON public.xero_profit_loss_raw 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view profit loss events" 
ON public.profit_loss_events 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert profit loss events" 
ON public.profit_loss_events 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update profit loss events" 
ON public.profit_loss_events 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_xero_accounts_updated_at
BEFORE UPDATE ON public.xero_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profit_loss_events_updated_at
BEFORE UPDATE ON public.profit_loss_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();;
