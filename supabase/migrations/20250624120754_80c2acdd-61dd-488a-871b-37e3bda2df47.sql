
-- Create the bookings table
CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Customer Information
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    
    -- Booking Details
    booking_type TEXT NOT NULL CHECK (booking_type IN ('venue_hire', 'vip_tickets')),
    venue TEXT NOT NULL CHECK (venue IN ('manor', 'hippie')),
    
    -- Venue Hire Specific
    venue_area TEXT CHECK (venue_area IN ('upstairs', 'downstairs', 'full_venue')), -- Only for venue_hire
    
    -- Date/Time
    booking_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_hours INTEGER, -- For venue hire bookings
    
    -- Booking Specifics
    guest_count INTEGER DEFAULT 1,
    ticket_quantity INTEGER, -- For VIP ticket bookings
    special_requests TEXT,
    
    -- Status & Financial
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_amount DECIMAL(10,2), -- For future pricing implementation
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'refunded')),
    
    -- Export tracking for VIP tickets
    exported_to_megatix BOOLEAN DEFAULT FALSE,
    export_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    staff_notes TEXT
);

-- Create the customers table (simplified)
CREATE TABLE public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for bookings
CREATE INDEX idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_venue ON public.bookings(venue);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_type ON public.bookings(booking_type);
CREATE INDEX idx_bookings_export ON public.bookings(exported_to_megatix) WHERE booking_type = 'vip_tickets';

-- Performance indexes for customers
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_phone ON public.customers(phone);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Simple policy: authenticated users have full access (Stage 1 - internal tool)
CREATE POLICY "Authenticated users full access" ON public.bookings
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users full access" ON public.customers
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-confirm venue hire bookings
CREATE OR REPLACE FUNCTION public.auto_confirm_venue_hire()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_type = 'venue_hire' THEN
        NEW.status = 'confirmed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER handle_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER auto_confirm_venue_hire_trigger
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_venue_hire();

-- Apply updated_at trigger to customers table
CREATE TRIGGER handle_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
;
