-- Create photo_albums table
CREATE TABLE IF NOT EXISTS public.photo_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue text NOT NULL CHECK (venue IN ('hippie', 'manor')),
  event_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false NOT NULL
);

-- Create unique index on venue + event_date to prevent duplicate albums for same date
CREATE UNIQUE INDEX photo_albums_venue_event_date_idx ON public.photo_albums (venue, event_date);

-- Create index for filtering by venue
CREATE INDEX photo_albums_venue_idx ON public.photo_albums (venue);

-- Create index for sorting by event_date
CREATE INDEX photo_albums_event_date_idx ON public.photo_albums (event_date DESC);

-- Create photo_album_images table
CREATE TABLE IF NOT EXISTS public.photo_album_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.photo_albums(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false NOT NULL
);

-- Create index for fetching photos by album
CREATE INDEX photo_album_images_album_id_idx ON public.photo_album_images (album_id);

-- Create index for ordering photos
CREATE INDEX photo_album_images_display_order_idx ON public.photo_album_images (album_id, display_order);

-- Enable RLS on both tables
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_album_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for photo_albums

-- Authenticated users can read all albums
CREATE POLICY "Authenticated users can read all albums"
  ON public.photo_albums
  FOR SELECT
  TO authenticated
  USING (true);

-- Public (anon) can read non-archived albums
CREATE POLICY "Public can read non-archived albums"
  ON public.photo_albums
  FOR SELECT
  TO anon
  USING (archived = false);

-- Authenticated users can insert albums
CREATE POLICY "Authenticated users can insert albums"
  ON public.photo_albums
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update albums
CREATE POLICY "Authenticated users can update albums"
  ON public.photo_albums
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete albums
CREATE POLICY "Authenticated users can delete albums"
  ON public.photo_albums
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for photo_album_images

-- Authenticated users can read all images
CREATE POLICY "Authenticated users can read all images"
  ON public.photo_album_images
  FOR SELECT
  TO authenticated
  USING (true);

-- Public (anon) can read non-archived images from non-archived albums
CREATE POLICY "Public can read non-archived images"
  ON public.photo_album_images
  FOR SELECT
  TO anon
  USING (
    archived = false 
    AND EXISTS (
      SELECT 1 FROM public.photo_albums 
      WHERE photo_albums.id = photo_album_images.album_id 
      AND photo_albums.archived = false
    )
  );

-- Authenticated users can insert images
CREATE POLICY "Authenticated users can insert images"
  ON public.photo_album_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update images
CREATE POLICY "Authenticated users can update images"
  ON public.photo_album_images
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete images
CREATE POLICY "Authenticated users can delete images"
  ON public.photo_album_images
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for photo_albums updated_at
CREATE TRIGGER photo_albums_updated_at
  BEFORE UPDATE ON public.photo_albums
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create storage bucket for venue photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-photos', 'venue-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for venue-photos bucket

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'venue-photos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'venue-photos')
  WITH CHECK (bucket_id = 'venue-photos');

-- Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'venue-photos');

-- Allow public read access to all photos
CREATE POLICY "Public can read venue photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'venue-photos');;
