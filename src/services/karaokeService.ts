import { supabase } from "@/integrations/supabase/client";
import { 
  KaraokeBoothRow, 
  KaraokeBoothInsert, 
  KaraokeBoothUpdate,
  KaraokeBookingRow,
  KaraokeBookingFormData,
  KaraokeAvailability,
  TimeSlot,
  BookingConflictCheck,
  BookingConflictResult,
  KaraokeBookingFilters,
  KaraokeBoothFilters
} from "@/types/karaoke";

// NOTE: This service is designed to work with the karaoke_booths table and extended bookings table
// It will require the database migration to be applied first

export const karaokeService = {
  // ===== KARAOKE BOOTH OPERATIONS =====
  
  /**
   * Get all karaoke booths with optional filters
   * NOTE: Requires migration to be applied first
   */
  async getKaraokeBooths(filters?: KaraokeBoothFilters): Promise<KaraokeBoothRow[]> {
    try {
      let query = supabase
        .from('karaoke_booths')
        .select('*')
        .order('venue', { ascending: true })
        .order('name', { ascending: true });

      // By default, don't show archived booths unless explicitly requested
      if (filters?.is_archived === true) {
        query = query.eq('is_archived', true);
      } else if (filters?.is_archived === false || filters?.is_archived === undefined) {
        query = query.eq('is_archived', false);
      }

      if (filters?.venue && filters.venue !== 'all') {
        query = query.eq('venue', filters.venue);
      }

      if (filters?.is_available !== undefined) {
        query = query.eq('is_available', filters.is_available);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch karaoke booths: ${error.message}`);
      }

      return (data || []) as unknown as KaraokeBoothRow[];
    } catch (_error) {
      throw new Error('Karaoke booths table not found. Please apply the database migration first.');
    }
  },

  /**
   * Get a single karaoke booth by ID
   */
  async getKaraokeBooth(id: string): Promise<KaraokeBoothRow> {
    try {
      const { data, error } = await supabase
        .from('karaoke_booths')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch karaoke booth: ${error.message}`);
      }

      return data as unknown as KaraokeBoothRow;
    } catch (_error) {
      throw new Error('Karaoke booth not found. Please apply the database migration first.');
    }
  },

  /**
   * Create a new karaoke booth
   */
  async createKaraokeBooth(data: KaraokeBoothInsert): Promise<KaraokeBoothRow> {
    try {
      const { data: booth, error } = await supabase
        .from('karaoke_booths')
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create karaoke booth: ${error.message}`);
      }

      return booth as unknown as KaraokeBoothRow;
    } catch (_error) {
      throw new Error('Failed to create karaoke booth. Please apply the database migration first.');
    }
  },

  /**
   * Update an existing karaoke booth
   */
  async updateKaraokeBooth(id: string, updates: KaraokeBoothUpdate): Promise<KaraokeBoothRow> {
    try {
      const { data: booth, error } = await supabase
        .from('karaoke_booths')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update karaoke booth: ${error.message}`);
      }

      return booth as unknown as KaraokeBoothRow;
    } catch (_error) {
      throw new Error('Failed to update karaoke booth. Please apply the database migration first.');
    }
  },

  /**
   * Toggle booth availability
   */
  async toggleBoothAvailability(id: string, is_available: boolean): Promise<KaraokeBoothRow> {
    return this.updateKaraokeBooth(id, { is_available });
  },

  /**
   * Archive a karaoke booth (soft delete)
   */
  async archiveBooth(id: string): Promise<KaraokeBoothRow> {
    return this.updateKaraokeBooth(id, { is_archived: true, is_available: false });
  },

  /**
   * Restore an archived karaoke booth
   */
  async restoreBooth(id: string): Promise<KaraokeBoothRow> {
    return this.updateKaraokeBooth(id, { is_archived: false });
  },

  // ===== KARAOKE BOOKING OPERATIONS =====

  /**
   * Create a new karaoke booking
   */
  async createKaraokeBooking(formData: KaraokeBookingFormData): Promise<KaraokeBookingRow> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Calculate duration in hours
    const startTime = new Date(`2000-01-01T${formData.start_time}:00`);
    const endTime = new Date(`2000-01-01T${formData.end_time}:00`);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Check for conflicts before creating
    const conflictCheck = await this.checkBookingConflicts({
      booth_id: formData.booth_id,
      date: formData.booking_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
    });

    if (conflictCheck.has_conflict) {
      throw new Error(conflictCheck.message || 'This time slot is already booked');
    }

    // Get booth details for pricing
    const booth = await this.getKaraokeBooth(formData.booth_id);
    const totalAmount = booth.hourly_rate * durationHours;

    const bookingData = {
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      booking_type: 'karaoke_booking',
      venue: formData.venue,
      karaoke_booth_id: formData.booth_id,
      booking_date: formData.booking_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      duration_hours: durationHours,
      guest_count: formData.guest_count,
      special_requests: formData.special_requests,
      total_amount: totalAmount,
      status: 'confirmed', // Auto-confirm karaoke bookings
      staff_notes: formData.staff_notes,
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

    return booking as unknown as KaraokeBookingRow;
  },

  /**
   * Check for booking conflicts
   */
  async checkBookingConflicts(check: BookingConflictCheck): Promise<BookingConflictResult> {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('booking_type', 'karaoke_booking')
      .eq('karaoke_booth_id', check.booth_id)
      .eq('booking_date', check.date)
      .neq('status', 'cancelled');

    if (check.exclude_booking_id) {
      query = query.neq('id', check.exclude_booking_id);
    }

    const { data: bookings, error } = await query;

    if (error) {
      throw new Error(`Failed to check booking conflicts: ${error.message}`);
    }

    // Check for time overlaps
    const conflictingBookings = (bookings || []).filter(booking => {
      if (!booking.start_time || !booking.end_time) return false;
      
      const bookingStart = booking.start_time;
      const bookingEnd = booking.end_time;
      
      // Check if the time ranges overlap
      return (check.start_time < bookingEnd && check.end_time > bookingStart);
    });

    const hasConflict = conflictingBookings.length > 0;
    
    return {
      has_conflict: hasConflict,
      conflicting_bookings: conflictingBookings as unknown as KaraokeBookingRow[],
      message: hasConflict ? `This time slot conflicts with existing booking for ${conflictingBookings[0].customer_name}` : undefined,
    };
  },

  /**
   * Get availability for a specific booth on a specific date
   */
  async getBoothAvailability(boothId: string, date: string): Promise<KaraokeAvailability> {
    const booth = await this.getKaraokeBooth(boothId);
    
    // Get all bookings for this booth on this date
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_type', 'karaoke_booking')
      .eq('karaoke_booth_id', boothId)
      .eq('booking_date', date)
      .neq('status', 'cancelled');

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    // Generate time slots from 10:00 to 23:00
    const timeSlots: TimeSlot[] = [];
    for (let hour = 10; hour <= 22; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      
      // Check if this time slot is available
      const conflictingBooking = (bookings || []).find(booking => {
        if (!booking.start_time || !booking.end_time) return false;
        return timeString >= booking.start_time && timeString < booking.end_time;
      });

      timeSlots.push({
        time: timeString,
        available: !conflictingBooking,
        booking: conflictingBooking as unknown as KaraokeBookingRow,
      });
    }

    return {
      booth_id: boothId,
      booth_name: booth.name,
      date: date,
      time_slots: timeSlots,
      is_booth_available: booth.is_available,
    };
  },

  // ===== UTILITY FUNCTIONS =====

  /**
   * Generate time slots for booking selection
   */
  generateTimeSlots(startHour: number = 10, endHour: number = 23): string[] {
    const slots: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  },

  /**
   * Validate booking time range
   */
  validateBookingTime(startTime: string, endTime: string): { valid: boolean; message?: string } {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    
    // Allow overnight ranges (e.g. 23:00 -> 00:00) by rolling the end into the next day.
    if (end.getTime() === start.getTime()) {
      return { valid: false, message: 'End time must be different from start time' };
    }
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    if (durationHours < 1) {
      return { valid: false, message: 'Minimum booking duration is 1 hour' };
    }

    if (durationHours > 8) {
      return { valid: false, message: 'Maximum booking duration is 8 hours' };
    }

    return { valid: true };
  },

  /**
   * Calculate booking cost
   */
  calculateBookingCost(startTime: string, endTime: string, hourlyRate: number): number {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return hourlyRate * durationHours;
  },

  // ===== HOLDS AND AVAILABILITY (EDGE FUNCTIONS) =====

  async getAvailability(params: { boothId?: string; venue?: 'manor' | 'hippie'; minCapacity?: number; bookingDate: string; granularityMinutes?: number; action?: 'boothsForSlot'; startTime?: string; endTime?: string }) {
    const { data, error } = await supabase.functions.invoke('karaoke-availability', {
      body: params,
    });
    if (error) {
      throw new Error(error.message || 'Failed to fetch availability');
    }
    return data;
  },

  async createHold(params: { boothId: string; venue: 'manor' | 'hippie'; bookingDate: string; startTime: string; endTime: string; sessionId: string; customerEmail?: string; ttlMinutes?: number }) {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');
    const res = await fetch(`${API_BASE}/karaoke/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-action': 'create'
      },
      body: JSON.stringify(params)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to create hold');
    return json;
  },

  async extendHold(params: { holdId: string; sessionId: string; ttlMinutes?: number }) {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');
    const res = await fetch(`${API_BASE}/karaoke/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-action': 'extend'
      },
      body: JSON.stringify(params)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to extend hold');
    return json;
  },

  async releaseHold(params: { holdId: string; sessionId: string }) {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');
    const res = await fetch(`${API_BASE}/karaoke/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-action': 'release'
      },
      body: JSON.stringify(params)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to release hold');
    return json;
  },

  async finalizeHold(params: { holdId: string; sessionId: string; customerName: string; customerEmail?: string; customerPhone?: string; guestCount?: number }) {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');
    const res = await fetch(`${API_BASE}/karaoke/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to finalize hold');
    return json;
  },

  // ===== STAFF/ADMIN HOLDS QUERIES =====
  async getActiveHolds(params: { boothId: string; bookingDate: string }) {
    const { data, error } = await supabase
      .from('karaoke_booth_holds' as any)
      .select('*')
      .eq('booth_id', params.boothId)
      .eq('booking_date', params.bookingDate)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('start_time', { ascending: true });
    if (error) {
      throw new Error(error.message || 'Failed to fetch active holds');
    }
    return data;
  },

  async staffReleaseHold(holdId: string) {
    const { data, error } = await supabase
      .from('karaoke_booth_holds' as any)
      .update({ status: 'released' })
      .eq('id', holdId)
      .select()
      .single();
    if (error) {
      throw new Error(error.message || 'Failed to release hold');
    }
    return data;
  },

}; 