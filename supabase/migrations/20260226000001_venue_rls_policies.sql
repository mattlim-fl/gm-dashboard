-- Update RLS policies to enforce venue-based access control
-- This migration updates existing policies on bookings, members, and customers tables.

-- ============================================================
-- BOOKINGS TABLE - Per-venue data
-- ============================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users full access" ON public.bookings;

-- Create venue-based policies
CREATE POLICY "Users can view bookings for their venues"
  ON public.bookings FOR SELECT
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Users can insert bookings for their venues"
  ON public.bookings FOR INSERT
  WITH CHECK (public.user_has_venue_access(venue));

CREATE POLICY "Users can update bookings for their venues"
  ON public.bookings FOR UPDATE
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Users can delete bookings for their venues"
  ON public.bookings FOR DELETE
  USING (public.user_has_venue_access(venue));

-- ============================================================
-- MEMBERS TABLE - Per-venue data
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated read" ON public.members;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.members;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.members;

-- Create venue-based policies
CREATE POLICY "Users can view members for their venues"
  ON public.members FOR SELECT
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Users can insert members for their venues"
  ON public.members FOR INSERT
  WITH CHECK (public.user_has_venue_access(venue));

CREATE POLICY "Users can update members for their venues"
  ON public.members FOR UPDATE
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Users can delete members for their venues"
  ON public.members FOR DELETE
  USING (public.user_has_venue_access(venue));

-- ============================================================
-- MEMBER_CHECKINS TABLE - Linked to members (venue via member)
-- ============================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users full access" ON public.member_checkins;

-- Create policy that checks venue through the linked member
CREATE POLICY "Users can manage checkins for their venue members"
  ON public.member_checkins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_checkins.member_id
        AND public.user_has_venue_access(m.venue)
    )
  );

-- ============================================================
-- CUSTOMERS TABLE - Shared across venues
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users full access" ON public.customers;

-- Admins can view all customers
CREATE POLICY "Admins can view all customers"
  ON public.customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

-- Users can view customers from their venue bookings
CREATE POLICY "Users can view customers from their venue bookings"
  ON public.customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE (b.customer_email = customers.email OR b.customer_phone = customers.phone)
        AND public.user_has_venue_access(b.venue)
    )
  );

-- Admins can insert/update/delete customers
CREATE POLICY "Admins can manage customers"
  ON public.customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

-- Users can insert customers (needed when creating bookings)
CREATE POLICY "Authenticated users can insert customers"
  ON public.customers FOR INSERT
  WITH CHECK (auth.jwt()->>'email' IS NOT NULL);

-- Users can update customers they can view
CREATE POLICY "Users can update customers from their venue bookings"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE (b.customer_email = customers.email OR b.customer_phone = customers.phone)
        AND public.user_has_venue_access(b.venue)
    )
  );

-- ============================================================
-- KARAOKE_BOOTHS TABLE - Per-venue data
-- ============================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users full access" ON public.karaoke_booths;

-- Create venue-based policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'karaoke_booths') THEN
    EXECUTE 'CREATE POLICY "Users can view booths for their venues"
      ON public.karaoke_booths FOR SELECT
      USING (public.user_has_venue_access(venue))';

    EXECUTE 'CREATE POLICY "Admins can manage karaoke booths"
      ON public.karaoke_booths FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.allowed_emails ae
          WHERE ae.email = auth.jwt()->>''email'' AND ae.role = ''admin''
        )
      )';
  END IF;
END $$;

-- ============================================================
-- OCCASIONS TABLE - Per-venue data (if exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'occasions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users full access" ON public.occasions';

    EXECUTE 'CREATE POLICY "Users can view occasions for their venues"
      ON public.occasions FOR SELECT
      USING (public.user_has_venue_access(venue))';

    EXECUTE 'CREATE POLICY "Users can insert occasions for their venues"
      ON public.occasions FOR INSERT
      WITH CHECK (public.user_has_venue_access(venue))';

    EXECUTE 'CREATE POLICY "Users can update occasions for their venues"
      ON public.occasions FOR UPDATE
      USING (public.user_has_venue_access(venue))';

    EXECUTE 'CREATE POLICY "Users can delete occasions for their venues"
      ON public.occasions FOR DELETE
      USING (public.user_has_venue_access(venue))';
  END IF;
END $$;
