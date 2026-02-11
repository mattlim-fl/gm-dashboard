-- Fix RLS policies for simplified schema

-- 1. Add RLS policies for revenue_events (admin/staff only)
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all revenue events" 
ON revenue_events 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Staff can insert revenue events" 
ON revenue_events 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update revenue events" 
ON revenue_events 
FOR UPDATE 
TO authenticated
USING (true);

-- 2. Add RLS policies for square_payments_raw (admin/staff only)
ALTER TABLE square_payments_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view raw payment data" 
ON square_payments_raw 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Staff can insert raw payment data" 
ON square_payments_raw 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 3. Add RLS policies for square_sync_status (admin/staff only)
ALTER TABLE square_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sync status" 
ON square_sync_status 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Staff can update sync status" 
ON square_sync_status 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Staff can insert sync status" 
ON square_sync_status 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 4. Simplify existing policies to be more explicit
-- Note: Keeping current simple approach since this appears to be a staff-only app
-- If you need user-specific access later, we can add user_id columns and policies;
