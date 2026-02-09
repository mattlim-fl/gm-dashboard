-- Add public read policy for photo_albums and photo_album_images tables
-- These tables need to be publicly readable for the venue websites (hippieclub.com, manorleederville.com)
-- without requiring authentication

-- Ensure RLS is enabled on photo_albums
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;

-- Drop existing public policy if it exists (idempotent)
DROP POLICY IF EXISTS "Public can view non-archived albums" ON public.photo_albums;

-- Create policy allowing anyone to SELECT non-archived albums
CREATE POLICY "Public can view non-archived albums"
  ON public.photo_albums
  FOR SELECT
  TO anon, authenticated
  USING (archived = false);

-- Ensure RLS is enabled on photo_album_images
ALTER TABLE public.photo_album_images ENABLE ROW LEVEL SECURITY;

-- Drop existing public policy if it exists (idempotent)
DROP POLICY IF EXISTS "Public can view non-archived images" ON public.photo_album_images;

-- Create policy allowing anyone to SELECT non-archived images (for albums they can see)
CREATE POLICY "Public can view non-archived images"
  ON public.photo_album_images
  FOR SELECT
  TO anon, authenticated
  USING (
    archived = false
    AND EXISTS (
      SELECT 1 FROM public.photo_albums
      WHERE photo_albums.id = photo_album_images.album_id
      AND photo_albums.archived = false
    )
  );

-- Also ensure staff can manage these tables (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Staff can manage photo albums" ON public.photo_albums;
CREATE POLICY "Staff can manage photo albums"
  ON public.photo_albums
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE allowed_emails.email = auth.jwt() ->> 'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE allowed_emails.email = auth.jwt() ->> 'email'
    )
  );

DROP POLICY IF EXISTS "Staff can manage photo album images" ON public.photo_album_images;
CREATE POLICY "Staff can manage photo album images"
  ON public.photo_album_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE allowed_emails.email = auth.jwt() ->> 'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE allowed_emails.email = auth.jwt() ->> 'email'
    )
  );
