import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { karaokeService } from '../karaokeService'
import { supabase } from '@/integrations/supabase/client'

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}))

// Mock the config
vi.mock('@/config/env', () => ({
  config: {
    apiBaseUrl: 'https://api.example.com',
  },
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create chainable mock
function createChainableMock(finalResult: { data: unknown; error: unknown }) {
  const mock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    then: vi.fn((resolve) => Promise.resolve(finalResult).then(resolve)),
  }
  return mock
}

describe('karaokeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================
  // Karaoke Booth Operations Tests
  // ============================================

  describe('getKaraokeBooths', () => {
    it('returns all non-archived booths by default', async () => {
      const mockBooths = [
        { id: '1', name: 'Booth A', venue: 'manor', is_archived: false },
        { id: '2', name: 'Booth B', venue: 'manor', is_archived: false },
      ]

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: mockBooths, error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.getKaraokeBooths()

      expect(result).toEqual(mockBooths)
      expect(chainMock.eq).toHaveBeenCalledWith('is_archived', false)
    })

    it('filters by venue', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await karaokeService.getKaraokeBooths({ venue: 'hippie' })

      expect(chainMock.eq).toHaveBeenCalledWith('venue', 'hippie')
    })

    it('does not filter venue when "all"', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await karaokeService.getKaraokeBooths({ venue: 'all' })

      // eq should be called for is_archived but not venue
      expect(chainMock.eq).toHaveBeenCalledTimes(1)
      expect(chainMock.eq).toHaveBeenCalledWith('is_archived', false)
    })

    it('filters by availability', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await karaokeService.getKaraokeBooths({ is_available: true })

      expect(chainMock.eq).toHaveBeenCalledWith('is_available', true)
    })

    it('filters archived booths when explicitly requested', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await karaokeService.getKaraokeBooths({ is_archived: true })

      expect(chainMock.eq).toHaveBeenCalledWith('is_archived', true)
    })
  })

  describe('getKaraokeBooth', () => {
    it('returns single booth by ID', async () => {
      const mockBooth = { id: 'booth-1', name: 'Booth A', venue: 'manor' }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.getKaraokeBooth('booth-1')

      expect(result).toEqual(mockBooth)
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'booth-1')
    })

    it('throws error when booth not found', async () => {
      const chainMock = createChainableMock({
        data: null,
        error: { message: 'Not found' },
      })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await expect(karaokeService.getKaraokeBooth('nonexistent')).rejects.toThrow()
    })
  })

  describe('createKaraokeBooth', () => {
    it('creates booth successfully', async () => {
      const mockBooth = { id: 'booth-1', name: 'New Booth', venue: 'manor' }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.createKaraokeBooth({
        name: 'New Booth',
        venue: 'manor',
      })

      expect(result).toEqual(mockBooth)
      expect(chainMock.insert).toHaveBeenCalled()
    })
  })

  describe('updateKaraokeBooth', () => {
    it('updates booth successfully', async () => {
      const mockBooth = { id: 'booth-1', name: 'Updated Name' }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.updateKaraokeBooth('booth-1', {
        name: 'Updated Name',
      })

      expect(result).toEqual(mockBooth)
      expect(chainMock.update).toHaveBeenCalled()
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'booth-1')
    })
  })

  describe('toggleBoothAvailability', () => {
    it('sets booth availability', async () => {
      const mockBooth = { id: 'booth-1', is_available: false }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.toggleBoothAvailability('booth-1', false)

      expect(result.is_available).toBe(false)
      expect(chainMock.update).toHaveBeenCalledWith({ is_available: false })
    })
  })

  describe('archiveBooth', () => {
    it('archives booth', async () => {
      const mockBooth = { id: 'booth-1', is_archived: true, is_available: false }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.archiveBooth('booth-1')

      expect(result.is_archived).toBe(true)
      expect(result.is_available).toBe(false)
      expect(chainMock.update).toHaveBeenCalledWith({
        is_archived: true,
        is_available: false,
      })
    })
  })

  describe('restoreBooth', () => {
    it('restores archived booth', async () => {
      const mockBooth = { id: 'booth-1', is_archived: false }
      const chainMock = createChainableMock({ data: mockBooth, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.restoreBooth('booth-1')

      expect(result.is_archived).toBe(false)
      expect(chainMock.update).toHaveBeenCalledWith({ is_archived: false })
    })
  })

  // ============================================
  // Booking Conflict Tests
  // ============================================

  describe('checkBookingConflicts', () => {
    it('returns no conflict when slot is free', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.checkBookingConflicts({
        booth_id: 'booth-1',
        date: '2024-06-15',
        start_time: '19:00',
        end_time: '21:00',
      })

      expect(result.has_conflict).toBe(false)
      expect(result.conflicting_bookings).toHaveLength(0)
    })

    it('detects conflict with overlapping booking', async () => {
      const conflictingBooking = {
        id: 'booking-1',
        customer_name: 'John',
        start_time: '18:00',
        end_time: '20:00',
      }

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [conflictingBooking], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.checkBookingConflicts({
        booth_id: 'booth-1',
        date: '2024-06-15',
        start_time: '19:00', // Overlaps with 18:00-20:00
        end_time: '21:00',
      })

      expect(result.has_conflict).toBe(true)
      expect(result.conflicting_bookings).toHaveLength(1)
      expect(result.message).toContain('John')
    })

    it('ignores non-overlapping bookings', async () => {
      const nonOverlappingBooking = {
        id: 'booking-1',
        customer_name: 'Jane',
        start_time: '14:00',
        end_time: '16:00', // Ends before our slot starts
      }

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [nonOverlappingBooking], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.checkBookingConflicts({
        booth_id: 'booth-1',
        date: '2024-06-15',
        start_time: '19:00',
        end_time: '21:00',
      })

      expect(result.has_conflict).toBe(false)
    })

    it('excludes specified booking from conflict check', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      await karaokeService.checkBookingConflicts({
        booth_id: 'booth-1',
        date: '2024-06-15',
        start_time: '19:00',
        end_time: '21:00',
        exclude_booking_id: 'booking-to-exclude',
      })

      expect(chainMock.neq).toHaveBeenCalledWith('id', 'booking-to-exclude')
    })
  })

  // ============================================
  // Booth Availability Tests
  // ============================================

  describe('getBoothAvailability', () => {
    it('returns availability with time slots', async () => {
      const mockBooth = { id: 'booth-1', name: 'Booth A', is_available: true }
      const boothChain = createChainableMock({ data: mockBooth, error: null })

      // No bookings
      const bookingsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }

      vi.mocked(supabase.from)
        .mockReturnValueOnce(boothChain as never)
        .mockReturnValueOnce(bookingsChain as never)

      const result = await karaokeService.getBoothAvailability('booth-1', '2024-06-15')

      expect(result.booth_id).toBe('booth-1')
      expect(result.booth_name).toBe('Booth A')
      expect(result.is_booth_available).toBe(true)
      expect(result.time_slots.length).toBeGreaterThan(0)
      // All slots should be available when no bookings
      expect(result.time_slots.every((slot) => slot.available)).toBe(true)
    })

    it('marks booked slots as unavailable', async () => {
      const mockBooth = { id: 'booth-1', name: 'Booth A', is_available: true }
      const boothChain = createChainableMock({ data: mockBooth, error: null })

      const existingBooking = {
        start_time: '14:00',
        end_time: '16:00',
      }

      const bookingsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [existingBooking], error: null })),
      }

      vi.mocked(supabase.from)
        .mockReturnValueOnce(boothChain as never)
        .mockReturnValueOnce(bookingsChain as never)

      const result = await karaokeService.getBoothAvailability('booth-1', '2024-06-15')

      // 14:00 and 15:00 should be unavailable
      const slot14 = result.time_slots.find((s) => s.time === '14:00')
      const slot15 = result.time_slots.find((s) => s.time === '15:00')
      const slot16 = result.time_slots.find((s) => s.time === '16:00')

      expect(slot14?.available).toBe(false)
      expect(slot15?.available).toBe(false)
      expect(slot16?.available).toBe(true) // Booking ends at 16:00
    })
  })

  // ============================================
  // Pure Utility Function Tests
  // ============================================

  describe('generateTimeSlots', () => {
    it('generates slots from default hours (10-23)', () => {
      const slots = karaokeService.generateTimeSlots()

      expect(slots).toHaveLength(14)
      expect(slots[0]).toBe('10:00')
      expect(slots[slots.length - 1]).toBe('23:00')
    })

    it('generates slots with custom hours', () => {
      const slots = karaokeService.generateTimeSlots(18, 22)

      expect(slots).toHaveLength(5)
      expect(slots[0]).toBe('18:00')
      expect(slots[slots.length - 1]).toBe('22:00')
    })

    it('formats hours with leading zeros', () => {
      const slots = karaokeService.generateTimeSlots(8, 10)

      expect(slots[0]).toBe('08:00')
      expect(slots[1]).toBe('09:00')
    })
  })

  describe('validateBookingTime', () => {
    it('validates valid booking time', () => {
      const result = karaokeService.validateBookingTime('19:00', '21:00')

      expect(result.valid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    it('rejects same start and end time', () => {
      const result = karaokeService.validateBookingTime('19:00', '19:00')

      expect(result.valid).toBe(false)
      expect(result.message).toContain('different')
    })

    it('rejects booking less than 1 hour', () => {
      const result = karaokeService.validateBookingTime('19:00', '19:30')

      expect(result.valid).toBe(false)
      expect(result.message).toContain('1 hour')
    })

    it('rejects booking more than 8 hours', () => {
      const result = karaokeService.validateBookingTime('10:00', '19:00')

      expect(result.valid).toBe(false)
      expect(result.message).toContain('8 hours')
    })

    it('accepts overnight booking (handles day wrap)', () => {
      const result = karaokeService.validateBookingTime('23:00', '01:00')

      expect(result.valid).toBe(true)
    })

    it('accepts exactly 1 hour booking', () => {
      const result = karaokeService.validateBookingTime('19:00', '20:00')

      expect(result.valid).toBe(true)
    })

    it('accepts exactly 8 hour booking', () => {
      const result = karaokeService.validateBookingTime('10:00', '18:00')

      expect(result.valid).toBe(true)
    })
  })

  describe('calculateBookingCost', () => {
    it('calculates cost correctly for 2 hours', () => {
      const cost = karaokeService.calculateBookingCost('19:00', '21:00', 60)

      expect(cost).toBe(120) // 2 hours * $60/hr
    })

    it('calculates cost correctly for 1 hour', () => {
      const cost = karaokeService.calculateBookingCost('19:00', '20:00', 50)

      expect(cost).toBe(50) // 1 hour * $50/hr
    })

    it('handles overnight bookings', () => {
      const cost = karaokeService.calculateBookingCost('23:00', '01:00', 60)

      expect(cost).toBe(120) // 2 hours * $60/hr
    })

    it('handles fractional hours', () => {
      // 1.5 hours at $60/hr
      const cost = karaokeService.calculateBookingCost('19:00', '20:30', 60)

      expect(cost).toBe(90)
    })
  })

  // ============================================
  // Create Karaoke Booking Tests
  // ============================================

  describe('createKaraokeBooking', () => {
    const validFormData = {
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      venue: 'manor' as const,
      booth_id: 'booth-1',
      booking_date: '2024-06-15',
      start_time: '19:00',
      end_time: '21:00',
      guest_count: 4,
    }

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never)

      await expect(karaokeService.createKaraokeBooking(validFormData)).rejects.toThrow(
        'User not authenticated'
      )
    })

    it('throws error on booking conflict', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      // Mock conflict check to return conflict
      const conflictChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) =>
          resolve({
            data: [{ customer_name: 'Existing', start_time: '18:00', end_time: '20:00' }],
            error: null,
          })
        ),
      }
      vi.mocked(supabase.from).mockReturnValue(conflictChain as never)

      await expect(karaokeService.createKaraokeBooking(validFormData)).rejects.toThrow(
        'conflict'
      )
    })

    it('calculates total amount using booth rate', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never)

      // Mock no conflict
      const conflictChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
      }

      // Mock booth fetch
      const mockBooth = { id: 'booth-1', hourly_rate: 60 }
      const boothChain = createChainableMock({ data: mockBooth, error: null })

      // Mock booking insert
      const bookingChain = createChainableMock({
        data: { id: 'booking-1', total_amount: 120 },
        error: null,
      })

      vi.mocked(supabase.from)
        .mockReturnValueOnce(conflictChain as never) // conflict check
        .mockReturnValueOnce(boothChain as never) // booth fetch
        .mockReturnValueOnce(bookingChain as never) // insert

      const result = await karaokeService.createKaraokeBooking(validFormData)

      // 2 hours * $60/hr = $120
      expect(bookingChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 120,
          duration_hours: 2,
        })
      )
    })
  })

  // ============================================
  // Edge Function / API Tests
  // ============================================

  describe('getAvailability (edge function)', () => {
    it('invokes edge function with params', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { slots: [] },
        error: null,
      } as never)

      const result = await karaokeService.getAvailability({
        boothId: 'booth-1',
        bookingDate: '2024-06-15',
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('karaoke-availability', {
        body: {
          boothId: 'booth-1',
          bookingDate: '2024-06-15',
        },
      })
    })

    it('throws error on function failure', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Function error' },
      } as never)

      await expect(
        karaokeService.getAvailability({
          bookingDate: '2024-06-15',
        })
      ).rejects.toThrow('Function error')
    })
  })

  describe('createHold', () => {
    it('throws error when not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as never)

      await expect(
        karaokeService.createHold({
          boothId: 'booth-1',
          venue: 'manor',
          bookingDate: '2024-06-15',
          startTime: '19:00',
          endTime: '21:00',
          sessionId: 'session-123',
        })
      ).rejects.toThrow('User not authenticated')
    })

    it('calls API with correct headers', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'token-123' } },
        error: null,
      } as never)

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ holdId: 'hold-1' }),
      })

      await karaokeService.createHold({
        boothId: 'booth-1',
        venue: 'manor',
        bookingDate: '2024-06-15',
        startTime: '19:00',
        endTime: '21:00',
        sessionId: 'session-123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/karaoke/holds',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token-123',
            'x-action': 'create',
          }),
        })
      )
    })
  })

  describe('releaseHold', () => {
    it('releases hold via API', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'token-123' } },
        error: null,
      } as never)

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      await karaokeService.releaseHold({
        holdId: 'hold-1',
        sessionId: 'session-123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/karaoke/holds',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-action': 'release',
          }),
        })
      )
    })
  })

  describe('getActiveHolds', () => {
    it('fetches active holds for booth and date', async () => {
      const mockHolds = [
        { id: 'hold-1', start_time: '19:00', status: 'active' },
      ]

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockHolds, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.getActiveHolds({
        boothId: 'booth-1',
        bookingDate: '2024-06-15',
      })

      expect(result).toEqual(mockHolds)
      expect(chainMock.eq).toHaveBeenCalledWith('booth_id', 'booth-1')
      expect(chainMock.eq).toHaveBeenCalledWith('booking_date', '2024-06-15')
      expect(chainMock.eq).toHaveBeenCalledWith('status', 'active')
    })
  })

  describe('staffReleaseHold', () => {
    it('releases hold as staff', async () => {
      const mockHold = { id: 'hold-1', status: 'released' }
      const chainMock = createChainableMock({ data: mockHold, error: null })
      vi.mocked(supabase.from).mockReturnValue(chainMock as never)

      const result = await karaokeService.staffReleaseHold('hold-1')

      expect(result.status).toBe('released')
      expect(chainMock.update).toHaveBeenCalledWith({ status: 'released' })
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'hold-1')
    })
  })
})
