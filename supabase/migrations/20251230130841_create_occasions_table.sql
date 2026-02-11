-- Create occasions table for capacity-limited events
CREATE TABLE occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL CHECK (venue IN ('manor', 'hippie')),
  name TEXT NOT NULL,
  occasion_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  ticket_price_cents INTEGER DEFAULT 1000,
  organiser_name TEXT,
  organiser_email TEXT,
  organiser_phone TEXT,
  organiser_token TEXT UNIQUE,
  share_token TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add occasion_id to bookings table
ALTER TABLE bookings ADD COLUMN occasion_id UUID REFERENCES occasions(id);

-- Create index for faster lookups
CREATE INDEX idx_occasions_organiser_token ON occasions(organiser_token);
CREATE INDEX idx_occasions_share_token ON occasions(share_token);
CREATE INDEX idx_bookings_occasion_id ON bookings(occasion_id);

-- Enable RLS
ALTER TABLE occasions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for occasions
-- Staff can see all occasions
CREATE POLICY "Staff can view all occasions"
  ON occasions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles
      WHERE staff_profiles.id = auth.uid()
    )
  );

-- Staff can create occasions
CREATE POLICY "Staff can create occasions"
  ON occasions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles
      WHERE staff_profiles.id = auth.uid()
    )
  );

-- Staff can update occasions
CREATE POLICY "Staff can update occasions"
  ON occasions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles
      WHERE staff_profiles.id = auth.uid()
    )
  );

-- Comment on table
COMMENT ON TABLE occasions IS 'Capacity-limited events/occasions that can be shared with organisers and friends for ticket purchases';;
