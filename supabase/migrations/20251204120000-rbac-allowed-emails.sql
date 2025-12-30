-- RBAC v1: allowed_emails table and basic policies

-- 1. Role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'staff_role'
  ) THEN
    CREATE TYPE public.staff_role AS ENUM ('admin', 'user');
  END IF;
END;
$$;

-- 2. allowed_emails table
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users (id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies

-- Anyone authenticated can read (needed for login check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'allowed_emails'
      AND policyname = 'Authenticated can read allowed_emails'
  ) THEN
    CREATE POLICY "Authenticated can read allowed_emails"
      ON public.allowed_emails FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END;
$$;

-- Only admins can insert/update/delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'allowed_emails'
      AND policyname = 'Admins can manage allowed_emails'
  ) THEN
    CREATE POLICY "Admins can manage allowed_emails"
      ON public.allowed_emails FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.allowed_emails ae
          WHERE ae.email = auth.jwt()->>'email'
            AND ae.role = 'admin'
        )
      );
  END IF;
END;
$$;

-- 4. Seed initial admin (idempotent)
INSERT INTO public.allowed_emails (email, role)
VALUES ('matt@getproductbox.com', 'admin')
ON CONFLICT (email) DO NOTHING;


















