import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bookingService, updateVipTicketCheckins } from '../bookingService'
import { supabase } from '@/integrations/supabase/client'

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

// Helper to create chainable mock
function createChainableMock(finalResult: { data: unknown; error: unknown }) {
  const mock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    then: vi.fn((resolve) => Promise.resolve(finalResult).then(resolve)),
  }
  return mock
}

describe('bookingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================
  // checkKaraokeBoothAvailability Tests
  // ============================================

  describe('checkKaraokeBoothAvailability', () => {
    it('returns true when booth is available', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      const result = await bookingService.checkKaraokeBoothAvailability(
        'booth-1',
        '2024-06-15',
        '19:00',
        '21:00'
      )

      expect(result).toBe(true)
      expect(supabase.rpc).toHaveBeenCalledWith('get_karaoke_booth_availability', {
        booth_id: 'booth-1',
        booking_date: '2024-06-15',
        start_time: '19:00',
        end_time: '21:00',
        exclude_booking_id: null,
      })
    })

    it('returns false when booth is not available', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: false,
        error: null,
      } as never)

      const result = await bookingService.checkKaraokeBoothAvailability(
        'booth-1',
        '2024-06-15',
        '19:00',
        '21:00'
      )

      expect(result).toBe(false)
    })

    it('excludes booking ID when provided', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      await bookingService.checkKaraokeBoothAvailability(
        'booth-1',
        '2024-06-15',
        '19:00',
        '21:00',
        'booking-123'
      )

      expect(supabase.rpc).toHaveBeenCalledWith('get_karaoke_booth_availability', {
        booth_id: 'booth-1',
        booking_date: '2024-06-15',
        start_time: '19:00',
        end_time: '21:00',
        exclude_booking_id: 'booking-123',
      })
    })

    it('throws error on RPC failure', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      } as never)

      await expect(
        bookingService.checkKaraokeBoothAvailability(
          'booth-1',
          '2024-06-15',
          '19:00',
          '21:00'
        )
      ).rejects.toThrow('Failed to check booth availability')
    })
  })

  // ============================================
  // createVipTicketBookings Tests
  // ============================================

  describe('createVipTicketBookings', () => {
    const validVipData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      bookingType: 'vip_tickets' as const,
      venue: 'manor' as const,
      bookingDate: '2024-06-15',
      ticketQuantity: 2,
      costPerTicket: 50,
    }

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never)

      await expect(
        bookingService.createVipTicketBookings(validVipData)
      ).rejects.toThrow('User not authenticated')
    })

    it('throws error when ticket quantity missing', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const dataWithoutQuantity = { ...validVipData, ticketQuantity: undefined }

      await expect(
        bookingService.createVipTicketBookings(dataWithoutQuantity as never)
      ).rejects.toThrow('Ticket quantity and cost per ticket are required')
    })

    it('throws error when cost per ticket missing', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const dataWithoutCost = { ...validVipData, costPerTicket: undefined }

      await expect(
        bookingService.createVipTicketBookings(dataWithoutCost as never)
      ).rejects.toThrow('Ticket quantity and cost per ticket are required')
    })

    it('calculates total amount correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const mockBooking = { id: 'booking-1', ...validVipData, total_amount: 100 }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.createVipTicketBookings(validVipData)

      // Verify the insert was called with calculated total
      expect(chainMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 100, // 2 tickets * $50
        })
      )
    })

    it('creates booking successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const mockBooking = {
        id: 'booking-1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        booking_type: 'vip_tickets',
        venue: 'manor',
        booking_date: '2024-06-15',
        ticket_quantity: 2,
        total_amount: 100,
      }

      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.createVipTicketBookings(validVipData)

      expect(result).toEqual(mockBooking)
      expect(supabase.from).toHaveBeenCalledWith('bookings')
    })

    it('throws error on database failure', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const chainMock = createChainableMock({
        data: null,
        error: { message: 'Database error' },
      })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(
        bookingService.createVipTicketBookings(validVipData)
      ).rejects.toThrow('Failed to create VIP ticket booking')
    })
  })

  // ============================================
  // createBooking Tests (routing)
  // ============================================

  describe('createBooking', () => {
    it('routes VIP tickets to createVipTicketBookings', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const mockBooking = { id: 'booking-1', booking_type: 'vip_tickets' }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const vipData = {
        customerName: 'John',
        bookingType: 'vip_tickets' as const,
        venue: 'manor' as const,
        bookingDate: '2024-06-15',
        ticketQuantity: 2,
        costPerTicket: 50,
      }

      const result = await bookingService.createBooking(vipData)

      expect(result.booking_type).toBe('vip_tickets')
    })

    it('routes karaoke to createKaraokeBookingSimple', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      // Mock booth fetch
      const boothMock = createChainableMock({
        data: { id: 'booth-1', is_available: true, hourly_rate: 60 },
        error: null,
      })

      // Mock availability check
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      // Mock booking insert
      const bookingMock = createChainableMock({
        data: { id: 'booking-1', booking_type: 'karaoke_booking' },
        error: null,
      })

      // First call is for booth, second is for booking
      vi.mocked(supabase.from)
        .mockReturnValueOnce(boothMock as never)
        .mockReturnValueOnce(bookingMock as never)

      const karaokeData = {
        customerName: 'John',
        bookingType: 'karaoke_booking' as const,
        venue: 'manor' as const,
        bookingDate: '2024-06-15',
        karaokeBoothId: 'booth-1',
        startTime: '19:00',
        endTime: '21:00',
      }

      const result = await bookingService.createBooking(karaokeData)

      expect(result.booking_type).toBe('karaoke_booking')
    })

    it('creates venue hire booking directly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const mockBooking = {
        id: 'booking-1',
        booking_type: 'venue_hire',
        venue_area: 'upstairs',
      }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const venueHireData = {
        customerName: 'John',
        bookingType: 'venue_hire' as const,
        venue: 'manor' as const,
        venueArea: 'upstairs' as const,
        bookingDate: '2024-06-15',
        guestCount: 50,
      }

      const result = await bookingService.createBooking(venueHireData)

      expect(result.booking_type).toBe('venue_hire')
      expect(result.venue_area).toBe('upstairs')
    })
  })

  // ============================================
  // createKaraokeBookingSimple Tests
  // ============================================

  describe('createKaraokeBookingSimple', () => {
    const validKaraokeData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      bookingType: 'karaoke_booking' as const,
      venue: 'manor' as const,
      bookingDate: '2024-06-15',
      karaokeBoothId: 'booth-1',
      startTime: '19:00',
      endTime: '21:00',
      guestCount: 4,
    }

    it('throws error when booth ID missing', async () => {
      const dataWithoutBooth = { ...validKaraokeData, karaokeBoothId: undefined }

      await expect(
        bookingService.createKaraokeBookingSimple(dataWithoutBooth as never)
      ).rejects.toThrow('Karaoke booth ID is required')
    })

    it('throws error when start time missing', async () => {
      const dataWithoutStart = { ...validKaraokeData, startTime: undefined }

      await expect(
        bookingService.createKaraokeBookingSimple(dataWithoutStart as never)
      ).rejects.toThrow('Start time and end time are required')
    })

    it('throws error when end time missing', async () => {
      const dataWithoutEnd = { ...validKaraokeData, endTime: undefined }

      await expect(
        bookingService.createKaraokeBookingSimple(dataWithoutEnd as never)
      ).rejects.toThrow('Start time and end time are required')
    })

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never)

      await expect(
        bookingService.createKaraokeBookingSimple(validKaraokeData)
      ).rejects.toThrow('User not authenticated')
    })

    it('throws error when booth not available', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const boothMock = createChainableMock({
        data: { id: 'booth-1', is_available: false, hourly_rate: 60 },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(boothMock as never)

      await expect(
        bookingService.createKaraokeBookingSimple(validKaraokeData)
      ).rejects.toThrow('Selected karaoke booth is currently unavailable')
    })

    it('throws error on booking conflict', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const boothMock = createChainableMock({
        data: { id: 'booth-1', is_available: true, hourly_rate: 60 },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(boothMock as never)

      // Mock conflict
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: false, // Not available
        error: null,
      } as never)

      await expect(
        bookingService.createKaraokeBookingSimple(validKaraokeData)
      ).rejects.toThrow('Selected time slot is already booked')
    })

    it('calculates duration and total correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const boothMock = createChainableMock({
        data: { id: 'booth-1', is_available: true, hourly_rate: 60 },
        error: null,
      })
      const bookingMock = createChainableMock({
        data: { id: 'booking-1' },
        error: null,
      })

      vi.mocked(supabase.from)
        .mockReturnValueOnce(boothMock as never)
        .mockReturnValueOnce(bookingMock as never)

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      await bookingService.createKaraokeBookingSimple(validKaraokeData)

      // Verify insert was called with calculated values
      // 19:00 to 21:00 = 2 hours * $60/hr = $120
      expect(bookingMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_hours: 2,
          total_amount: 120,
        })
      )
    })

    it('uses default hourly rate when booth has none', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      const boothMock = createChainableMock({
        data: { id: 'booth-1', is_available: true, hourly_rate: null },
        error: null,
      })
      const bookingMock = createChainableMock({
        data: { id: 'booking-1' },
        error: null,
      })

      vi.mocked(supabase.from)
        .mockReturnValueOnce(boothMock as never)
        .mockReturnValueOnce(bookingMock as never)

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      await bookingService.createKaraokeBookingSimple(validKaraokeData)

      // Default rate is $25/hr, 2 hours = $50
      expect(bookingMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 50,
        })
      )
    })
  })

  // ============================================
  // getBookings Tests
  // ============================================

  describe('getBookings', () => {
    it('returns all bookings when no filters', async () => {
      const mockBookings = [
        { id: '1', customer_name: 'John' },
        { id: '2', customer_name: 'Jane' },
      ]
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: mockBookings, error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.getBookings()

      expect(result).toEqual(mockBookings)
      expect(chainMock.select).toHaveBeenCalledWith('*, booking_guests(*)')
    })

    it('applies venue filter', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.getBookings({ venue: 'manor' })

      expect(chainMock.eq).toHaveBeenCalledWith('venue', 'manor')
    })

    it('does not apply venue filter when "all"', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.getBookings({ venue: 'all' })

      expect(chainMock.eq).not.toHaveBeenCalledWith('venue', 'all')
    })

    it('applies booking type filter', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.getBookings({ bookingType: 'vip_tickets' })

      expect(chainMock.eq).toHaveBeenCalledWith('booking_type', 'vip_tickets')
    })

    it('applies date range filter', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.getBookings({
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      })

      expect(chainMock.gte).toHaveBeenCalledWith('booking_date', '2024-06-01')
      expect(chainMock.lte).toHaveBeenCalledWith('booking_date', '2024-06-30')
    })

    it('applies search filter', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.getBookings({ search: 'john' })

      expect(chainMock.or).toHaveBeenCalledWith(
        'customer_name.ilike.%john%,customer_email.ilike.%john%,customer_phone.ilike.%john%'
      )
    })

    it('returns empty array when no bookings', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: null, error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.getBookings()

      expect(result).toEqual([])
    })

    it('throws error on database failure', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: null, error: { message: 'DB error' } })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(bookingService.getBookings()).rejects.toThrow('Failed to fetch bookings')
    })
  })

  // ============================================
  // getBooking Tests
  // ============================================

  describe('getBooking', () => {
    it('returns single booking by ID', async () => {
      const mockBooking = { id: 'booking-123', customer_name: 'John' }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.getBooking('booking-123')

      expect(result).toEqual(mockBooking)
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'booking-123')
    })

    it('throws error when booking not found', async () => {
      const chainMock = createChainableMock({
        data: null,
        error: { message: 'Not found' },
      })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(bookingService.getBooking('nonexistent')).rejects.toThrow(
        'Failed to fetch booking'
      )
    })
  })

  // ============================================
  // updateBooking Tests
  // ============================================

  describe('updateBooking', () => {
    it('updates booking successfully', async () => {
      const mockBooking = { id: 'booking-123', customer_name: 'Jane' }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.updateBooking('booking-123', {
        customerName: 'Jane',
      })

      expect(result).toEqual(mockBooking)
      expect(chainMock.update).toHaveBeenCalled()
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'booking-123')
    })

    it('checks availability when updating karaoke booking time', async () => {
      // Mock availability check
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never)

      const mockBooking = { id: 'booking-123', booking_type: 'karaoke_booking' }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.updateBooking('booking-123', {
        bookingType: 'karaoke_booking',
        karaokeBoothId: 'booth-1',
        bookingDate: '2024-06-15',
        startTime: '20:00',
        endTime: '22:00',
      })

      expect(supabase.rpc).toHaveBeenCalledWith('get_karaoke_booth_availability', {
        booth_id: 'booth-1',
        booking_date: '2024-06-15',
        start_time: '20:00',
        end_time: '22:00',
        exclude_booking_id: 'booking-123',
      })
    })

    it('throws error on karaoke booking conflict', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: false, // Conflict
        error: null,
      } as never)

      await expect(
        bookingService.updateBooking('booking-123', {
          bookingType: 'karaoke_booking',
          karaokeBoothId: 'booth-1',
          bookingDate: '2024-06-15',
          startTime: '20:00',
          endTime: '22:00',
        })
      ).rejects.toThrow('Selected time slot is already booked')
    })
  })

  // ============================================
  // updateBookingStatus Tests
  // ============================================

  describe('updateBookingStatus', () => {
    const statuses = ['pending', 'confirmed', 'cancelled', 'completed'] as const

    statuses.forEach((status) => {
      it(`updates status to ${status}`, async () => {
        const mockBooking = { id: 'booking-123', status }
        const chainMock = createChainableMock({ data: mockBooking, error: null })
        vi.mocked(supabase.from).mockReturnValue(chainMock as never)

        const result = await bookingService.updateBookingStatus('booking-123', status)

        expect(result.status).toBe(status)
        expect(chainMock.update).toHaveBeenCalledWith({ status })
      })
    })

    it('throws error on failure', async () => {
      const chainMock = createChainableMock({
        data: null,
        error: { message: 'Update failed' },
      })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(
        bookingService.updateBookingStatus('booking-123', 'confirmed')
      ).rejects.toThrow('Failed to update booking status')
    })
  })

  // ============================================
  // getVipTicketsForExport Tests
  // ============================================

  describe('getVipTicketsForExport', () => {
    it('returns unexported VIP tickets', async () => {
      const mockBookings = [
        { id: '1', booking_type: 'vip_tickets', exported_to_megatix: false },
        { id: '2', booking_type: 'vip_tickets', exported_to_megatix: false },
      ]

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: mockBookings, error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.getVipTicketsForExport()

      expect(result).toEqual(mockBookings)
      expect(chainMock.eq).toHaveBeenCalledWith('booking_type', 'vip_tickets')
      expect(chainMock.eq).toHaveBeenCalledWith('exported_to_megatix', false)
    })

    it('returns empty array when none found', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: null, error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await bookingService.getVipTicketsForExport()

      expect(result).toEqual([])
    })
  })

  // ============================================
  // markVipTicketsAsExported Tests
  // ============================================

  describe('markVipTicketsAsExported', () => {
    it('marks multiple bookings as exported', async () => {
      const chainMock = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await bookingService.markVipTicketsAsExported(['booking-1', 'booking-2'])

      expect(chainMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          exported_to_megatix: true,
        })
      )
      expect(chainMock.in).toHaveBeenCalledWith('id', ['booking-1', 'booking-2'])
    })

    it('throws error on failure', async () => {
      const chainMock = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(
        bookingService.markVipTicketsAsExported(['booking-1'])
      ).rejects.toThrow('Failed to mark VIP tickets as exported')
    })
  })

  // ============================================
  // updateVipTicketCheckins Tests
  // ============================================

  describe('updateVipTicketCheckins', () => {
    it('updates ticket checkins', async () => {
      const mockBooking = {
        id: 'booking-123',
        ticket_checkins: ['checked', null],
      }
      const chainMock = createChainableMock({ data: mockBooking, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await updateVipTicketCheckins('booking-123', ['checked', null])

      expect(result.ticket_checkins).toEqual(['checked', null])
      expect(chainMock.update).toHaveBeenCalledWith({ ticket_checkins: ['checked', null] })
    })

    it('throws error on failure', async () => {
      const chainMock = createChainableMock({
        data: null,
        error: { message: 'Update failed' },
      })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(
        updateVipTicketCheckins('booking-123', ['checked'])
      ).rejects.toThrow('Failed to update ticket checkins')
    })
  })
})
