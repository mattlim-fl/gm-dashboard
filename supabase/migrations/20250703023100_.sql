-- Create venue_processing_jobs table for tracking background venue reprocessing jobs
CREATE TABLE public.venue_processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_payments INTEGER NOT NULL,
  days_back INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.venue_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff access
CREATE POLICY "Staff can view all venue processing jobs" 
ON public.venue_processing_jobs 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can insert venue processing jobs" 
ON public.venue_processing_jobs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff can update venue processing jobs" 
ON public.venue_processing_jobs 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_venue_processing_jobs_updated_at
BEFORE UPDATE ON public.venue_processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance on status queries
CREATE INDEX idx_venue_processing_jobs_status ON public.venue_processing_jobs(status);
CREATE INDEX idx_venue_processing_jobs_created_at ON public.venue_processing_jobs(created_at DESC);;
