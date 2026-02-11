
-- Clear existing revenue events table
DELETE FROM revenue_events;

-- Clear existing raw payments table  
DELETE FROM square_payments_raw;

-- Reset any stuck sync states
UPDATE square_sync_status 
SET sync_status = 'pending', 
    error_message = NULL,
    sync_session_id = NULL,
    cursor_position = NULL,
    payments_fetched = 0,
    payments_synced = 0,
    progress_percentage = 0,
    last_heartbeat = NULL
WHERE sync_status IN ('running', 'error');
;
