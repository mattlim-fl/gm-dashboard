
-- Add unique constraint on environment column to fix upsert operations
ALTER TABLE public.square_sync_status 
ADD CONSTRAINT square_sync_status_environment_unique UNIQUE (environment);
;
