// Karaoke Booth Types
// These types will be merged with the main database types once the migration is applied

export interface KaraokeBoothRow {
  id: string;
  name: string;
  venue: 'manor' | 'hippie';
  capacity: number;
  hourly_rate: number;
  is_available: boolean;
  is_archived: boolean;
  maintenance_notes: string | null;
  operating_hours_start: string; // TIME format "HH:MM"
  operating_hours_end: string;   // TIME format "HH:MM"
  created_at: string;
  updated_at: string;
}

export interface KaraokeBoothInsert {
  id?: string;
  name: string;
  venue: 'manor' | 'hippie';
  capacity?: number;
  hourly_rate?: number;
  is_available?: boolean;
  is_archived?: boolean;
  maintenance_notes?: string | null;
  operating_hours_start?: string;
  operating_hours_end?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KaraokeBoothUpdate {
  id?: string;
  name?: string;
  venue?: 'manor' | 'hippie';
  capacity?: number;
  hourly_rate?: number;
  is_available?: boolean;
  is_archived?: boolean;
  maintenance_notes?: string | null;
  operating_hours_start?: string;
  operating_hours_end?: string;
  created_at?: string;
  updated_at?: string;
}

// Extended booking types for karaoke functionality
export interface KaraokeBookingRow {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  booking_type: 'karaoke_booking';
  venue: 'manor' | 'hippie';
  venue_area: string | null;
  karaoke_booth_id: string; // NEW: Reference to karaoke booth
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  guest_count: number | null;
  ticket_quantity: number | null;
  special_requests: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_amount: number | null;
  payment_status: 'unpaid' | 'deposit_paid' | 'paid' | 'refunded' | null;
  exported_to_megatix: boolean | null;
  export_date: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  staff_notes: string | null;
}

export interface KaraokeBookingInsert {
  id?: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  booking_type: 'karaoke_booking';
  venue: 'manor' | 'hippie';
  venue_area?: string | null;
  karaoke_booth_id: string;
  booking_date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_hours?: number | null;
  guest_count?: number | null;
  ticket_quantity?: number | null;
  special_requests?: string | null;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_amount?: number | null;
  payment_status?: 'unpaid' | 'deposit_paid' | 'paid' | 'refunded' | null;
  exported_to_megatix?: boolean | null;
  export_date?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  staff_notes?: string | null;
}

// Time slot and availability types
export interface TimeSlot {
  time: string; // Format: "HH:MM"
  available: boolean;
  booking?: KaraokeBookingRow;
}

export interface KaraokeAvailability {
  booth_id: string;
  booth_name: string;
  date: string;
  time_slots: TimeSlot[];
  is_booth_available: boolean;
}

// Form data types
export interface KaraokeBookingFormData {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  venue: 'manor' | 'hippie';
  booth_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  special_requests?: string;
  staff_notes?: string;
}

// API response types
export interface KaraokeBookingWithBooth extends KaraokeBookingRow {
  karaoke_booth: KaraokeBoothRow;
}

export interface KaraokeBoothWithBookings extends KaraokeBoothRow {
  bookings: KaraokeBookingRow[];
}

// Calendar integration types
export interface KaraokeCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource_id: string;
  resource_name: string;
  customer_name: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  booking_type: 'karaoke_booking';
}

// Validation types
export interface BookingConflictCheck {
  booth_id: string;
  date: string;
  start_time: string;
  end_time: string;
  exclude_booking_id?: string;
}

export interface BookingConflictResult {
  has_conflict: boolean;
  conflicting_bookings: KaraokeBookingRow[];
  message?: string;
}

// Filter types
export interface KaraokeBookingFilters {
  venue?: 'manor' | 'hippie' | 'all';
  booth_id?: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'all';
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface KaraokeBoothFilters {
  venue?: 'manor' | 'hippie' | 'all';
  is_available?: boolean;
  is_archived?: boolean;
  search?: string;
}

// Utility types
export type KaraokeBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type KaraokeVenue = 'manor' | 'hippie';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'refunded'; 

// Holds and availability
export interface AvailabilitySlot {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  available: boolean;
  blockedBy?: 'booking' | 'hold';
  capacities?: number[]; // available booth capacities for this slot (venue-level)
}

export interface AvailabilityResponse {
  boothId: string;
  bookingDate: string; // YYYY-MM-DD
  granularityMinutes: number;
  slots: AvailabilitySlot[];
}

export interface KaraokeHoldRow {
  id: string;
  booth_id: string;
  venue: KaraokeVenue;
  booking_date: string; // YYYY-MM-DD
  start_time: string;   // HH:MM:SS
  end_time: string;     // HH:MM:SS
  session_id: string;
  customer_email: string | null;
  status: 'active' | 'released' | 'consumed' | 'expired';
  expires_at: string; // ISO timestamp
  booking_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHoldRequest {
  boothId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  sessionId: string;
  customerEmail?: string;
  venue: KaraokeVenue;
  ttlMinutes?: number;
}

export interface ModifyHoldRequest {
  holdId: string;
  sessionId: string;
  ttlMinutes?: number; // for extend
}

export interface FinalizeHoldRequest {
  holdId: string;
  sessionId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  guestCount?: number;
}