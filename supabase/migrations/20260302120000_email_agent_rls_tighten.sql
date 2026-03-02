-- Email Agent RLS Tightening
-- This migration restricts email agent tables to venue-based access control
-- using the user_venue_access table and helper functions.

-- =====================================================
-- email_agent_config: Restrict to user's accessible venues
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read email_agent_config" ON public.email_agent_config;
DROP POLICY IF EXISTS "Authenticated users can update email_agent_config" ON public.email_agent_config;
DROP POLICY IF EXISTS "Authenticated users can insert email_agent_config" ON public.email_agent_config;

-- Create venue-restricted policies
CREATE POLICY "Users can read email_agent_config for their venues"
  ON public.email_agent_config FOR SELECT
  TO authenticated
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Admins can update email_agent_config"
  ON public.email_agent_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email_agent_config"
  ON public.email_agent_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

-- =====================================================
-- knowledge_files: Restrict to user's accessible venues
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read knowledge_files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Authenticated users can update knowledge_files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Authenticated users can insert knowledge_files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Authenticated users can delete knowledge_files" ON public.knowledge_files;

-- Create venue-restricted policies
CREATE POLICY "Users can read knowledge_files for their venues"
  ON public.knowledge_files FOR SELECT
  TO authenticated
  USING (public.user_has_venue_access(venue));

CREATE POLICY "Admins can update knowledge_files"
  ON public.knowledge_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert knowledge_files"
  ON public.knowledge_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete knowledge_files"
  ON public.knowledge_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = auth.jwt()->>'email' AND ae.role = 'admin'
    )
  );

-- =====================================================
-- email_agent_logs: Restrict to user's accessible venues
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read email_agent_logs" ON public.email_agent_logs;

-- Create venue-restricted policies
CREATE POLICY "Users can read email_agent_logs for their venues"
  ON public.email_agent_logs FOR SELECT
  TO authenticated
  USING (public.user_has_venue_access(venue));

-- =====================================================
-- Remove venue CHECK constraint from email_agent tables
-- to allow dynamic venues (not just hippie/manor)
-- =====================================================

-- email_agent_config: Allow any venue (validated at application level)
ALTER TABLE public.email_agent_config
  DROP CONSTRAINT IF EXISTS email_agent_config_venue_check;

-- email_agent_logs: Allow any venue
ALTER TABLE public.email_agent_logs
  DROP CONSTRAINT IF EXISTS email_agent_logs_venue_check;

-- knowledge_files: Allow any venue
ALTER TABLE public.knowledge_files
  DROP CONSTRAINT IF EXISTS knowledge_files_venue_check;
