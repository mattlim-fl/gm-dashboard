-- Fix RLS Security Issues
-- This migration addresses several security issues identified in the RLS review:
-- 1. CRITICAL: Enable RLS on allowed_emails (currently disabled)
-- 2. CRITICAL: Fix hardcoded admin email in allowed_emails policy
-- 3. HIGH: Remove direct anon write access to booking_guests
-- 4. MEDIUM: Make notification_settings UPDATE admin-only
-- 5. MEDIUM: Make cost_benchmarks write operations admin-only
-- 6. MEDIUM: Make staff_profiles DELETE admin-only

-- ============================================================================
-- Step 1: Enable RLS on allowed_emails + Fix admin policy (CRITICAL)
-- ============================================================================
-- The allowed_emails table is the RBAC source table. RLS must be enabled.
-- IMPORTANT: Don't use FOR ALL policy as it blocks SELECT for non-admins.
-- Instead, use separate policies: SELECT for all authenticated, write ops for admins only.

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Drop the old policy with hardcoded email
DROP POLICY IF EXISTS "Admins can manage allowed_emails" ON public.allowed_emails;

-- Drop any existing read policy that might have wrong role assignment
DROP POLICY IF EXISTS "Authenticated can read allowed_emails" ON public.allowed_emails;

-- Create SELECT policy for authenticated users (all staff can read)
CREATE POLICY "Authenticated users can read allowed_emails"
  ON public.allowed_emails FOR SELECT
  TO authenticated
  USING (true);

-- Create INSERT policy for admins only
CREATE POLICY "Admins can insert allowed_emails"
  ON public.allowed_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- Create UPDATE policy for admins only
CREATE POLICY "Admins can update allowed_emails"
  ON public.allowed_emails FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- Create DELETE policy for admins only
CREATE POLICY "Admins can delete allowed_emails"
  ON public.allowed_emails FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- ============================================================================
-- Step 2: Remove direct anon write access to booking_guests (HIGH)
-- ============================================================================
-- Customers should use the RPC functions (get_booking_guests, upsert_booking_guests)
-- which properly validate tokens via validate_guest_list_token.
-- Direct table access bypasses token validation.

DROP POLICY IF EXISTS "Anyone can insert booking guests" ON public.booking_guests;
DROP POLICY IF EXISTS "Anyone can delete booking guests" ON public.booking_guests;

-- ============================================================================
-- Step 3: Make notification_settings UPDATE admin-only (MEDIUM)
-- ============================================================================
-- Only admins should be able to modify notification schedules (recipients, timing, etc.)

-- First drop any existing update policy
DROP POLICY IF EXISTS "Admins can update notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Authenticated users can update notification settings" ON public.notification_settings;

CREATE POLICY "Admins can update notification_settings"
  ON public.notification_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- ============================================================================
-- Step 4: Make cost_benchmarks write operations admin-only (MEDIUM)
-- ============================================================================
-- Only admins should be able to modify cost benchmark percentages.

DROP POLICY IF EXISTS "Authenticated users can insert benchmarks" ON public.cost_benchmarks;
DROP POLICY IF EXISTS "Authenticated users can update benchmarks" ON public.cost_benchmarks;

CREATE POLICY "Admins can insert cost_benchmarks"
  ON public.cost_benchmarks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

CREATE POLICY "Admins can update cost_benchmarks"
  ON public.cost_benchmarks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );

-- ============================================================================
-- Step 5: Make staff_profiles DELETE admin-only (MEDIUM)
-- ============================================================================
-- Only admins should be able to delete staff profiles.

DROP POLICY IF EXISTS "Staff can delete staff profiles" ON public.staff_profiles;

CREATE POLICY "Admins can delete staff_profiles"
  ON public.staff_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email'
        AND ae.role = 'admin'
    )
  );
