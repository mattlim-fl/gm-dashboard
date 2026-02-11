
-- Add cursor tracking and progress fields to square_sync_status table
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS sync_session_id UUID;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS cursor_position TEXT;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS current_date_range_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS current_date_range_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS total_estimated INTEGER DEFAULT 0;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS payments_fetched INTEGER DEFAULT 0;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS is_continuation BOOLEAN DEFAULT false;
ALTER TABLE public.square_sync_status ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_square_sync_status_session ON square_sync_status(sync_session_id);
CREATE INDEX IF NOT EXISTS idx_square_sync_status_environment_status ON square_sync_status(environment, sync_status);

-- Add function to reset stuck sync states (older than 10 minutes)
CREATE OR REPLACE FUNCTION public.reset_stuck_sync_states()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.square_sync_status
  SET 
    sync_status = 'error',
    error_message = 'Sync was stuck in running state and automatically reset',
    sync_session_id = NULL,
    cursor_position = NULL,
    is_continuation = false,
    last_heartbeat = NULL
  WHERE 
    sync_status = 'running' 
    AND (last_sync_attempt < NOW() - INTERVAL '10 minutes' OR last_heartbeat < NOW() - INTERVAL '2 minutes');
END;
$$;
;
