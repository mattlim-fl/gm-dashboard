-- Create members table for unified membership across all venues
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL CHECK (venue IN ('manor', 'hippie', 'daisy')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  membership_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  membership_expiry TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months'),
  first_visit_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue, phone)  -- One membership per phone per venue
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for landing page signups)
CREATE POLICY "Allow public insert" ON members
  FOR INSERT WITH CHECK (true);

-- Allow authenticated users to read all members
CREATE POLICY "Allow authenticated read" ON members
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update members
CREATE POLICY "Allow authenticated update" ON members
  FOR UPDATE TO authenticated USING (true);

-- Create indexes for faster lookups
CREATE INDEX idx_members_venue ON members(venue);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_status ON members(status);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_members_updated_at();

-- Remove is_member column from customers table
ALTER TABLE customers DROP COLUMN IF EXISTS is_member;

-- Add 'daisy' to bookings venue CHECK constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_venue_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_venue_check
  CHECK (venue = ANY (ARRAY['manor'::text, 'hippie'::text, 'daisy'::text]));

-- Add 'daisy' to karaoke_booths venue CHECK constraint
ALTER TABLE karaoke_booths DROP CONSTRAINT IF EXISTS karaoke_booths_venue_check;
ALTER TABLE karaoke_booths ADD CONSTRAINT karaoke_booths_venue_check
  CHECK (venue = ANY (ARRAY['manor'::text, 'hippie'::text, 'daisy'::text]));

-- Add 'daisy' to karaoke_booth_holds venue CHECK constraint
ALTER TABLE karaoke_booth_holds DROP CONSTRAINT IF EXISTS karaoke_booth_holds_venue_check;
ALTER TABLE karaoke_booth_holds ADD CONSTRAINT karaoke_booth_holds_venue_check
  CHECK (venue = ANY (ARRAY['manor'::text, 'hippie'::text, 'daisy'::text]));

-- Add 'daisy' to venue_areas venue CHECK constraint
ALTER TABLE venue_areas DROP CONSTRAINT IF EXISTS venue_areas_venue_check;
ALTER TABLE venue_areas ADD CONSTRAINT venue_areas_venue_check
  CHECK (venue = ANY (ARRAY['manor'::text, 'hippie'::text, 'daisy'::text]));

-- Add 'daisy' to photo_albums venue CHECK constraint
ALTER TABLE photo_albums DROP CONSTRAINT IF EXISTS photo_albums_venue_check;
ALTER TABLE photo_albums ADD CONSTRAINT photo_albums_venue_check
  CHECK (venue = ANY (ARRAY['manor'::text, 'hippie'::text, 'daisy'::text]));
