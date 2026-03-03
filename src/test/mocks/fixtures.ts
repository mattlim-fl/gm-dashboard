import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type { Venue } from '@/types/venue'
import type { KaraokeBoothRow, KaraokeBookingRow, KaraokeHoldRow } from '@/types/karaoke'

/**
 * Test data factories for consistent mock data across tests
 */

// ============================================
// Booking Fixtures
// ============================================

let bookingIdCounter = 1

export function createBooking(
  overrides: Partial<Tables<'bookings'>> = {}
): Tables<'bookings'> {
  const id = overrides.id || `booking-${bookingIdCounter++}`
  return {
    id,
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '+61412345678',
    booking_type: 'table_booking',
    venue: 'manor',
    venue_area: 'main',
    booking_date: '2024-03-15',
    start_time: '19:00',
    end_time: '21:00',
    guest_count: 4,
    status: 'confirmed',
    payment_status: 'paid',
    total_amount: 200,
    special_requests: null,
    staff_notes: null,
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2024-03-01T10:00:00Z',
    created_by: null,
    exported_to_megatix: false,
    export_date: null,
    ticket_quantity: null,
    ticket_price_cents: null,
    duration_hours: 2,
    karaoke_booth_id: null,
    parent_booking_id: null,
    square_payment_id: null,
    share_token: null,
    guest_list_token: null,
    organiser_token: null,
    occasion_name: null,
    is_occasion_organiser: null,
    reference_code: null,
    booking_source: null,
    capacity: null,
    ticket_checkins: null,
    payment_attempted_at: null,
    payment_completed_at: null,
    ...overrides,
  }
}

export function createVipBooking(
  overrides: Partial<Tables<'bookings'>> = {}
): Tables<'bookings'> {
  return createBooking({
    booking_type: 'vip_ticket',
    ticket_quantity: 2,
    ticket_price_cents: 5000,
    total_amount: 100,
    ...overrides,
  })
}

export function createKaraokeBookingRecord(
  overrides: Partial<Tables<'bookings'>> = {}
): Tables<'bookings'> {
  return createBooking({
    booking_type: 'karaoke_booking',
    karaoke_booth_id: 'booth-1',
    duration_hours: 2,
    total_amount: 120,
    ...overrides,
  })
}

// ============================================
// Customer Fixtures
// ============================================

let customerIdCounter = 1

export function createCustomer(
  overrides: Partial<Tables<'customers'>> = {}
): Tables<'customers'> {
  const id = overrides.id || `customer-${customerIdCounter++}`
  return {
    id,
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+61498765432',
    notes: null,
    is_archived: false,
    archived_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================
// Member Fixtures
// ============================================

let memberIdCounter = 1

export function createMember(
  overrides: Partial<Tables<'members'>> = {}
): Tables<'members'> {
  const id = overrides.id || `member-${memberIdCounter++}`
  return {
    id,
    venue: 'manor',
    name: 'Bob Member',
    phone: '+61411111111',
    date_of_birth: '1990-05-15',
    membership_start: '2024-01-01',
    membership_expiry: '2025-01-01',
    first_visit_date: '2024-01-15',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================
// Karaoke Booth Fixtures
// ============================================

let boothIdCounter = 1

export function createKaraokeBooth(
  overrides: Partial<KaraokeBoothRow> = {}
): KaraokeBoothRow {
  const id = overrides.id || `booth-${boothIdCounter++}`
  return {
    id,
    name: 'Booth A',
    venue: 'manor',
    capacity: 8,
    hourly_rate: 60,
    is_available: true,
    is_archived: false,
    maintenance_notes: null,
    operating_hours_start: '18:00',
    operating_hours_end: '02:00',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================
// Karaoke Hold Fixtures
// ============================================

let holdIdCounter = 1

export function createKaraokeHold(
  overrides: Partial<KaraokeHoldRow> = {}
): KaraokeHoldRow {
  const id = overrides.id || `hold-${holdIdCounter++}`
  return {
    id,
    booth_id: 'booth-1',
    venue: 'manor',
    booking_date: '2024-03-15',
    start_time: '19:00:00',
    end_time: '21:00:00',
    session_id: 'session-123',
    customer_email: null,
    status: 'active',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    booking_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// Revenue Event Fixtures
// ============================================

let revenueIdCounter = 1

export function createRevenueEvent(
  overrides: Partial<Tables<'revenue_events'>> = {}
): Tables<'revenue_events'> {
  const id = overrides.id || `revenue-${revenueIdCounter++}`
  return {
    id,
    venue: 'manor',
    revenue_type: 'bar',
    amount_cents: 5000,
    payment_date: '2024-03-15',
    payment_hour: 21,
    payment_day_of_week: 6,
    square_payment_id: `payment-${id}`,
    status: 'completed',
    currency: 'AUD',
    created_at: '2024-03-15T21:00:00Z',
    updated_at: '2024-03-15T21:00:00Z',
    processed_at: '2024-03-15T21:00:00Z',
    ...overrides,
  }
}

// ============================================
// Venue Area Fixtures
// ============================================

export function createVenueArea(
  overrides: Partial<Tables<'venue_areas'>> = {}
): Tables<'venue_areas'> {
  return {
    id: 1,
    venue: 'manor',
    code: 'main',
    name: 'Main Area',
    description: 'Main dining area',
    capacity_min: 2,
    capacity_max: 50,
    is_active: true,
    sort_order: 1,
    image_url: null,
    weekly_hours: {},
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================
// Square Payment Fixtures
// ============================================

export function createSquarePaymentRaw(
  overrides: Partial<Tables<'square_payments_raw'>> = {}
): Tables<'square_payments_raw'> {
  return {
    id: `raw-${Date.now()}`,
    square_payment_id: `sq-payment-${Date.now()}`,
    raw_response: {
      id: 'payment-123',
      amount_money: { amount: 5000, currency: 'AUD' },
      status: 'COMPLETED',
      created_at: '2024-03-15T21:00:00Z',
    },
    synced_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// Bulk Fixtures
// ============================================

export function createBookingList(count: number, baseOverrides: Partial<Tables<'bookings'>> = []): Tables<'bookings'>[] {
  return Array.from({ length: count }, (_, i) =>
    createBooking({
      ...baseOverrides,
      customer_name: `Customer ${i + 1}`,
      customer_email: `customer${i + 1}@example.com`,
    })
  )
}

export function createRevenueEventList(
  count: number,
  baseOverrides: Partial<Tables<'revenue_events'>> = {}
): Tables<'revenue_events'>[] {
  return Array.from({ length: count }, (_, i) =>
    createRevenueEvent({
      ...baseOverrides,
      amount_cents: (i + 1) * 1000,
    })
  )
}

// ============================================
// Reset Counters (for test isolation)
// ============================================

export function resetFixtureCounters() {
  bookingIdCounter = 1
  customerIdCounter = 1
  memberIdCounter = 1
  boothIdCounter = 1
  holdIdCounter = 1
  revenueIdCounter = 1
}
