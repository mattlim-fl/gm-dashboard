import { supabase } from "@/integrations/supabase/client";

export interface Occasion {
  id: string;
  venue: 'manor' | 'hippie';
  occasion_name: string;
  booking_date: string;
  capacity: number;
  ticket_price_cents: number;
  customer_name: string | null; // organiser name
  customer_email: string | null;
  customer_phone: string | null;
  organiser_token: string | null;
  share_token: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOccasionInput {
  venue: 'manor' | 'hippie';
  name: string;
  occasion_date: string;
  capacity: number;
  ticket_price_cents: number;
  organiser_name?: string;
  organiser_email?: string;
  organiser_phone?: string;
  notes?: string;
  send_email?: boolean;
}

export interface UpdateOccasionInput {
  name?: string;
  occasion_date?: string;
  capacity?: number;
  ticket_price_cents?: number;
  organiser_name?: string;
  organiser_email?: string;
  organiser_phone?: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

export interface OccasionWithStats extends Occasion {
  occasion_date?: string; // Mapped from booking_date for component compatibility
  total_bookings: number;
  total_guests: number;
  remaining_capacity: number;
}

// Generate a random token for organiser or share links
function generateToken(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomPart = Array.from({ length: 8 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
  return `${prefix}-${randomPart}`;
}

export const occasionService = {
  /**
   * Create a new occasion (as an organiser booking)
   */
  async createOccasion(input: CreateOccasionInput): Promise<Occasion> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Generate tokens
    const organiserToken = generateToken('ORG');
    const shareToken = generateToken('OCC');

    const bookingData = {
      booking_type: 'occasion',
      is_occasion_organiser: true,
      occasion_name: input.name,
      venue: input.venue,
      booking_date: input.occasion_date,
      capacity: input.capacity,
      ticket_price_cents: input.ticket_price_cents,
      ticket_quantity: 0, // Organiser booking starts with 0
      customer_name: input.organiser_name || null,
      customer_email: input.organiser_email || null,
      customer_phone: input.organiser_phone || null,
      organiser_token: organiserToken,
      share_token: shareToken,
      staff_notes: input.notes || null,
      status: 'confirmed',
      payment_status: 'paid', // Organiser booking is "free"
      created_by: user.id,
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create occasion: ${error.message}`);
    }

    // Send email to organiser if email provided and send_email is true
    if (input.send_email && input.organiser_email && organiserToken) {
      try {
        const origin = window.location.origin.replace('gm-dashboard', input.venue === 'manor' ? 'manorleederville' : 'hippie-club');
        const organiserUrl = `${origin}/occasion/${organiserToken}`;
        
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'occasion-organiser-confirmation',
            data: {
              organiserName: input.organiser_name,
              organiserEmail: input.organiser_email,
              occasionName: input.name,
              occasionDate: input.occasion_date,
              venue: input.venue === 'manor' ? 'Manor' : 'Hippie Club',
              capacity: input.capacity,
              organiserUrl,
            }
          }
        });
      } catch (e) {
        console.warn('Non-blocking: failed to send organiser email', e);
      }
    }

    return booking as Occasion;
  },

  /**
   * Get all occasions with optional filters
   */
  async getOccasions(filters?: {
    venue?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<OccasionWithStats[]> {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('booking_type', 'occasion')
      .eq('is_occasion_organiser', true)
      .order('booking_date', { ascending: false });

    if (filters?.venue && filters.venue !== 'all') {
      query = query.eq('venue', filters.venue);
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

    const { data: occasions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch occasions: ${error.message}`);
    }

    if (!occasions || occasions.length === 0) {
      return [];
    }

    // Fetch booking stats for each occasion (child bookings)
    const occasionIds = occasions.map(o => o.id);
    const { data: childBookings } = await supabase
      .from('bookings')
      .select('parent_booking_id, ticket_quantity')
      .in('parent_booking_id', occasionIds)
      .neq('status', 'cancelled');

    // Calculate stats
    const statsMap = new Map<string, { total_bookings: number; total_guests: number }>();
    
    if (childBookings) {
      childBookings.forEach(booking => {
        if (!booking.parent_booking_id) return;
        
        const current = statsMap.get(booking.parent_booking_id) || { total_bookings: 0, total_guests: 0 };
        current.total_bookings += 1;
        current.total_guests += booking.ticket_quantity || 0;
        statsMap.set(booking.parent_booking_id, current);
      });
    }

    return occasions.map(occasion => {
      const stats = statsMap.get(occasion.id) || { total_bookings: 0, total_guests: 0 };
      return {
        ...occasion,
        occasion_name: occasion.occasion_name || '',
        occasion_date: occasion.booking_date, // Map booking_date to occasion_date for component compatibility
        total_bookings: stats.total_bookings,
        total_guests: stats.total_guests,
        remaining_capacity: (occasion.capacity || 0) - stats.total_guests,
      } as OccasionWithStats;
    });
  },

  /**
   * Get a single occasion by ID
   */
  async getOccasion(id: string): Promise<OccasionWithStats> {
    const { data: occasion, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('booking_type', 'occasion')
      .eq('is_occasion_organiser', true)
      .single();

    if (error) {
      throw new Error(`Failed to fetch occasion: ${error.message}`);
    }

    // Get child booking stats
    const { data: childBookings } = await supabase
      .from('bookings')
      .select('ticket_quantity')
      .eq('parent_booking_id', id)
      .neq('status', 'cancelled');

    const total_bookings = childBookings?.length || 0;
    const total_guests = childBookings?.reduce((sum, b) => sum + (b.ticket_quantity || 0), 0) || 0;

    return {
      ...occasion,
      occasion_name: occasion.occasion_name || '',
      occasion_date: occasion.booking_date, // Map booking_date to occasion_date for component compatibility
      total_bookings,
      total_guests,
      remaining_capacity: (occasion.capacity || 0) - total_guests,
    } as OccasionWithStats;
  },

  /**
   * Update an occasion
   */
  async updateOccasion(id: string, updates: UpdateOccasionInput): Promise<Occasion> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.occasion_name = updates.name;
    if (updates.occasion_date !== undefined) updateData.booking_date = updates.occasion_date;
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.ticket_price_cents !== undefined) updateData.ticket_price_cents = updates.ticket_price_cents;
    if (updates.organiser_name !== undefined) updateData.customer_name = updates.organiser_name;
    if (updates.organiser_email !== undefined) updateData.customer_email = updates.organiser_email;
    if (updates.organiser_phone !== undefined) updateData.customer_phone = updates.organiser_phone;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.staff_notes = updates.notes;

    const { data: occasion, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .eq('booking_type', 'occasion')
      .eq('is_occasion_organiser', true)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update occasion: ${error.message}`);
    }

    return occasion as Occasion;
  },

  /**
   * Get all bookings for an occasion (child bookings)
   */
  async getOccasionBookings(occasionId: string) {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, booking_guests(*)')
      .eq('parent_booking_id', occasionId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch occasion bookings: ${error.message}`);
    }

    return bookings || [];
  },

  /**
   * Get organiser URL for an occasion
   */
  getOrganiserUrl(occasion: Occasion): string {
    if (!occasion.organiser_token) return '';
    const baseUrl = occasion.venue === 'manor' 
      ? 'https://manorleederville.com' 
      : 'https://hippie-club.com';
    return `${baseUrl}/occasion/${occasion.organiser_token}`;
  },

  /**
   * Get share URL for friends to purchase tickets
   */
  getShareUrl(occasion: Occasion): string {
    if (!occasion.share_token) return '';
    const baseUrl = occasion.venue === 'manor' 
      ? 'https://manorleederville.com' 
      : 'https://hippie-club.com';
    return `${baseUrl}/occasion/buy/${occasion.share_token}`;
  },
};
