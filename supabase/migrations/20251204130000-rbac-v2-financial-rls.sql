-- RBAC v2: tighten financial table RLS so only admins can read financial data

-- Helper expression is duplicated inline to avoid creating a custom function.

-- 1. revenue_events
DROP POLICY IF EXISTS "Staff can view all revenue events" ON public.revenue_events;
DROP POLICY IF EXISTS "Staff can insert revenue events" ON public.revenue_events;
DROP POLICY IF EXISTS "Staff can update revenue events" ON public.revenue_events;

CREATE POLICY "Admins can view revenue_events"
  ON public.revenue_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- 2. orders
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can delete orders" ON public.orders;

CREATE POLICY "Admins can view orders"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- 3. square_orders_raw
DROP POLICY IF EXISTS "Staff can view raw orders" ON public.square_orders_raw;
-- Keep \"System can insert raw orders\" policy as-is so service_role inserts continue to work.

CREATE POLICY "Admins can view square_orders_raw"
  ON public.square_orders_raw
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- 4. square_payments_raw
DROP POLICY IF EXISTS "Staff can view raw payment data" ON public.square_payments_raw;
DROP POLICY IF EXISTS "Staff can insert raw payment data" ON public.square_payments_raw;

CREATE POLICY "Admins can view square_payments_raw"
  ON public.square_payments_raw
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );


















