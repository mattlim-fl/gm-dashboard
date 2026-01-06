
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type BookingRow = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

export interface CreateBookingData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingType: 'venue_hire' | 'vip_tickets' | 'karaoke_booking';
  venue: 'manor' | 'hippie';
  venueArea?: 'upstairs' | 'downstairs' | 'full_venue' | 'karaoke';
  karaokeBoothId?: string; // For karaoke bookings
  bookingDate: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  guestCount?: number;
  ticketQuantity?: number;
  specialRequests?: string;
  totalAmount?: number;
  costPerTicket?: number;
  staffNotes?: string;
}

export interface BookingFilters {
  venue?: string;
  bookingType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function updateVipTicketCheckins(bookingId: string, checkins: (string | null)[]): Promise<BookingRow> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({ ticket_checkins: checkins })
    .eq('id', bookingId)
    .select('*')
    .single();

if (error) {
      throw new Error(`Failed to update ticket checkins: ${error.message}`);
    }

  return booking as BookingRow;
}

export const bookingService = {
  // Check karaoke booth availability
  async checkKaraokeBoothAvailability(
    boothId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const { data: isAvailable, error } = await supabase
      .rpc('get_karaoke_booth_availability', {
        booth_id: boothId,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        exclude_booking_id: excludeBookingId || null
      });

    if (error) {
      throw new Error(`Failed to check booth availability: ${error.message}`);
    }

    return isAvailable;
  },

  // Create VIP ticket booking (single entry with ticket quantity)
  async createVipTicketBookings(data: CreateBookingData): Promise<BookingRow> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!data.ticketQuantity || !data.costPerTicket) {
      throw new Error('Ticket quantity and cost per ticket are required for VIP bookings');
    }

    // Create single booking entry with total ticket quantity and amount
    const bookingData: BookingInsert = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      booking_type: data.bookingType,
      venue: data.venue,
      booking_date: data.bookingDate,
      ticket_quantity: data.ticketQuantity,
      total_amount: data.costPerTicket * data.ticketQuantity,
      special_requests: data.specialRequests,
      staff_notes: data.staffNotes,
      created_by: user.id,
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create VIP ticket booking: ${error.message}`);
    }

    return booking;
  },

  // Create a new booking (handles venue hire, VIP tickets, and karaoke bookings)
  async createBooking(data: CreateBookingData): Promise<BookingRow> {
    // For VIP tickets, use the single entry creation method
    if (data.bookingType === 'vip_tickets') {
      return this.createVipTicketBookings(data);
    }

    // For karaoke bookings, use simplified creation (no conflict checking until migration applied)
    if (data.bookingType === 'karaoke_booking') {
      return this.createKaraokeBookingSimple(data);
    }

    // For venue hire, create single booking as before
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const bookingData: BookingInsert = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      booking_type: data.bookingType,
      venue: data.venue,
      venue_area: data.venueArea,
      booking_date: data.bookingDate,
      start_time: data.startTime,
      end_time: data.endTime,
      duration_hours: data.durationHours,
      guest_count: data.guestCount,
      special_requests: data.specialRequests,
      total_amount: data.totalAmount,
      staff_notes: data.staffNotes,
      created_by: user.id,
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create booking: ${error.message}`);
    }

    return booking;
  },

  // Create karaoke booking with proper schema
  async createKaraokeBookingSimple(data: CreateBookingData): Promise<BookingRow> {
    if (!data.karaokeBoothId) {
      throw new Error('Karaoke booth ID is required for karaoke bookings');
    }

    if (!data.startTime || !data.endTime) {
      throw new Error('Start time and end time are required for karaoke bookings');
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get booth details for rate calculation
    const { data: booth, error: boothError } = await supabase
      .from('karaoke_booths')
      .select('*')
      .eq('id', data.karaokeBoothId)
      .single();

    if (boothError) {
      throw new Error('Failed to fetch booth details');
    }

    // Check if booth is available
    if (!booth.is_available) {
      throw new Error('Selected karaoke booth is currently unavailable');
    }

    // Check for booking conflicts
    const isAvailable = await this.checkKaraokeBoothAvailability(
      data.karaokeBoothId,
      data.bookingDate,
      data.startTime,
      data.endTime
    );

    if (!isAvailable) {
      throw new Error('Selected time slot is already booked for this karaoke booth');
    }

    // Calculate duration in hours
    const startTime = new Date(`2000-01-01T${data.startTime}:00`);
    const endTime = new Date(`2000-01-01T${data.endTime}:00`);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Calculate total amount using booth's hourly rate
    const hourlyRate = booth.hourly_rate || 25.00;
    const totalAmount = hourlyRate * durationHours;

    // Create booking data with proper karaoke_booking type
    const bookingData: BookingInsert = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      booking_type: 'karaoke_booking', // Now using proper type
      venue: data.venue,
      venue_area: null, // Not needed for karaoke bookings
      karaoke_booth_id: data.karaokeBoothId, // Store booth ID directly
      booking_date: data.bookingDate,
      start_time: data.startTime,
      end_time: data.endTime,
      duration_hours: durationHours,
      guest_count: data.guestCount,
      special_requests: data.specialRequests,
      total_amount: totalAmount,
      staff_notes: data.staffNotes,
      status: 'confirmed', // Auto-confirm karaoke bookings
      created_by: user.id,
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create karaoke booking: ${error.message}`);
    }

    return booking;
  },

  // Get all bookings with optional filters
  async getBookings(filters?: BookingFilters): Promise<BookingRow[]> {
    let query = supabase
      .from('bookings')
      .select('*, booking_guests(*)')
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: true });

    // Apply filters
    if (filters?.venue && filters.venue !== 'all') {
      query = query.eq('venue', filters.venue);
    }

    if (filters?.bookingType && filters.bookingType !== 'all') {
      query = query.eq('booking_type', filters.bookingType);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.dateFrom) {
      query = query.gte('booking_date', filters.dateFrom);
    }

    if (filters?.dateTo) {
      query = query.lte('booking_date', filters.dateTo);
    }

    if (filters?.search) {
      query = query.or(`customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`);
    }

    const { data: bookings, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    return bookings || [];
  },

  async getBooking(id: string): Promise<BookingRow> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch booking: ${error.message}`);
    }

    return booking;
  },

  async updateBooking(id: string, updates: Partial<CreateBookingData>): Promise<BookingRow> {
    // Check for karaoke booking conflicts if updating time/date/booth
    if (updates.bookingType === 'karaoke_booking' && updates.karaokeBoothId) {
      if (updates.bookingDate && updates.startTime && updates.endTime) {
        const isAvailable = await this.checkKaraokeBoothAvailability(
          updates.karaokeBoothId,
          updates.bookingDate,
          updates.startTime,
          updates.endTime,
          id // Exclude current booking from conflict check
        );

        if (!isAvailable) {
          throw new Error('Selected time slot is already booked for this karaoke booth');
        }
      }
    }

    const updateData: BookingUpdate = {
      customer_name: updates.customerName,
      customer_email: updates.customerEmail,
      customer_phone: updates.customerPhone,
      booking_type: updates.bookingType,
      venue: updates.venue,
      venue_area: updates.venueArea,
      karaoke_booth_id: updates.karaokeBoothId,
      booking_date: updates.bookingDate,
      start_time: updates.startTime,
      end_time: updates.endTime,
      duration_hours: updates.durationHours,
      guest_count: updates.guestCount,
      ticket_quantity: updates.ticketQuantity,
      special_requests: updates.specialRequests,
      total_amount: updates.totalAmount,
      staff_notes: updates.staffNotes,
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update booking: ${error.message}`);
    }

    return booking;
  },

  async updateBookingStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled' | 'completed'): Promise<BookingRow> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update booking status: ${error.message}`);
    }

    return booking;
  },

  async getVipTicketsForExport(): Promise<BookingRow[]> {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_type', 'vip_tickets')
      .eq('exported_to_megatix', false)
      .order('booking_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch VIP tickets for export: ${error.message}`);
    }

    return bookings || [];
  },

  async markVipTicketsAsExported(bookingIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        exported_to_megatix: true, 
        export_date: new Date().toISOString() 
      })
      .in('id', bookingIds);

    if (error) {
      throw new Error(`Failed to mark VIP tickets as exported: ${error.message}`);
    }
  }
};
