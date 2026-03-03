import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHook, createTestQueryClient } from '@/test/utils/renderHook'
import {
  useBookings,
  useBooking,
  useCreateBooking,
  useUpdateBooking,
  useUpdateBookingStatus,
  useVipTicketsForExport,
  useMarkVipTicketsAsExported,
} from '../useBookings'
import { bookingService } from '@/services/bookingService'

// Mock bookingService
vi.mock('@/services/bookingService', () => ({
  bookingService: {
    getBookings: vi.fn(),
    getBooking: vi.fn(),
    createBooking: vi.fn(),
    updateBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    getVipTicketsForExport: vi.fn(),
    markVipTicketsAsExported: vi.fn(),
  },
}))

// Mock VenueContext
vi.mock('@/contexts/VenueContext', () => ({
  useVenue: () => ({
    selectedVenue: 'all',
    accessibleVenues: ['manor', 'hippie'],
    loading: false,
    canAccessVenue: () => true,
    hasMultipleVenues: true,
  }),
}))

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockBooking = {
  id: 'booking-1',
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  customer_phone: '0400000000',
  venue: 'manor' as const,
  booking_date: '2024-06-15',
  booking_type: 'venue_hire' as const,
  status: 'confirmed' as const,
  guest_count: 50,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockVipBooking = {
  ...mockBooking,
  id: 'vip-1',
  booking_type: 'vip_tickets' as const,
  ticket_quantity: 5,
  ticket_cost_per_ticket_cents: 5000,
}

describe('useBookings hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // useBookings Tests
  // ============================================

  describe('useBookings', () => {
    it('returns loading state initially', () => {
      vi.mocked(bookingService.getBookings).mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useBookings())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('returns bookings after loading', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([mockBooking])

      const { result } = renderHook(() => useBookings())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([mockBooking])
    })

    it('includes selectedVenue in query key', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const queryClient = createTestQueryClient()
      renderHook(() => useBookings(), { queryClient })

      await waitFor(() => {
        expect(bookingService.getBookings).toHaveBeenCalled()
      })

      // Query key should include venue context
      const queries = queryClient.getQueryCache().findAll()
      expect(queries.some((q) => q.queryKey.includes('all'))).toBe(true)
    })

    it('passes filters to service', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([mockBooking])

      renderHook(() => useBookings({ booking_type: 'venue_hire', status: 'confirmed' }))

      await waitFor(() => {
        expect(bookingService.getBookings).toHaveBeenCalledWith(
          expect.objectContaining({
            booking_type: 'venue_hire',
            status: 'confirmed',
          })
        )
      })
    })

    it('filters by date range', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([mockBooking])

      renderHook(() =>
        useBookings({
          startDate: '2024-06-01',
          endDate: '2024-06-30',
        })
      )

      await waitFor(() => {
        expect(bookingService.getBookings).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2024-06-01',
            endDate: '2024-06-30',
          })
        )
      })
    })
  })

  // ============================================
  // useBooking Tests
  // ============================================

  describe('useBooking', () => {
    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useBooking(''))

      expect(result.current.isLoading).toBe(false)
      expect(bookingService.getBooking).not.toHaveBeenCalled()
    })

    it('fetches booking by id', async () => {
      vi.mocked(bookingService.getBooking).mockResolvedValue(mockBooking)

      const { result } = renderHook(() => useBooking('booking-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockBooking)
      expect(bookingService.getBooking).toHaveBeenCalledWith('booking-1')
    })

    it('handles errors gracefully', async () => {
      vi.mocked(bookingService.getBooking).mockRejectedValue(new Error('Not found'))

      const { result } = renderHook(() => useBooking('invalid-id'))

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Not found')
    })
  })

  // ============================================
  // useCreateBooking Tests
  // ============================================

  describe('useCreateBooking', () => {
    it('creates venue hire booking and invalidates cache', async () => {
      vi.mocked(bookingService.createBooking).mockResolvedValue(mockBooking)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCreateBooking(), { queryClient })

      await result.current.mutateAsync({
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        venue: 'manor',
        booking_date: '2024-06-15',
        booking_type: 'venue_hire',
        status: 'confirmed',
        guest_count: 50,
      })

      expect(bookingService.createBooking).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
    })

    it('creates VIP ticket booking', async () => {
      vi.mocked(bookingService.createBooking).mockResolvedValue(mockVipBooking)

      const { result } = renderHook(() => useCreateBooking())

      await result.current.mutateAsync({
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        venue: 'manor',
        booking_date: '2024-06-15',
        booking_type: 'vip_tickets',
        status: 'confirmed',
        ticket_quantity: 5,
        ticket_cost_per_ticket_cents: 5000,
      })

      expect(bookingService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_type: 'vip_tickets',
          ticket_quantity: 5,
        })
      )
    })

    it('handles creation errors', async () => {
      const mockError = new Error('Validation failed')
      vi.mocked(bookingService.createBooking).mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateBooking())

      await expect(
        result.current.mutateAsync({
          customer_name: '',
          venue: 'manor',
          booking_date: '2024-06-15',
          booking_type: 'venue_hire',
          status: 'pending',
        })
      ).rejects.toThrow('Validation failed')
    })
  })

  // ============================================
  // useUpdateBooking Tests
  // ============================================

  describe('useUpdateBooking', () => {
    it('updates booking and invalidates cache', async () => {
      const updatedBooking = { ...mockBooking, guest_count: 100 }
      vi.mocked(bookingService.updateBooking).mockResolvedValue(updatedBooking)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useUpdateBooking(), { queryClient })

      await result.current.mutateAsync({
        id: 'booking-1',
        data: { guest_count: 100 },
      })

      expect(bookingService.updateBooking).toHaveBeenCalledWith('booking-1', { guest_count: 100 })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['booking', 'booking-1'] })
    })

    it('handles update errors', async () => {
      vi.mocked(bookingService.updateBooking).mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useUpdateBooking())

      await expect(
        result.current.mutateAsync({
          id: 'booking-1',
          data: { guest_count: -1 },
        })
      ).rejects.toThrow('Update failed')
    })
  })

  // ============================================
  // useUpdateBookingStatus Tests
  // ============================================

  describe('useUpdateBookingStatus', () => {
    it('updates status to confirmed', async () => {
      const confirmedBooking = { ...mockBooking, status: 'confirmed' as const }
      vi.mocked(bookingService.updateBookingStatus).mockResolvedValue(confirmedBooking)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useUpdateBookingStatus(), { queryClient })

      await result.current.mutateAsync({
        id: 'booking-1',
        status: 'confirmed',
      })

      expect(bookingService.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'confirmed')
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
    })

    it('updates status to cancelled', async () => {
      const cancelledBooking = { ...mockBooking, status: 'cancelled' as const }
      vi.mocked(bookingService.updateBookingStatus).mockResolvedValue(cancelledBooking)

      const { result } = renderHook(() => useUpdateBookingStatus())

      await result.current.mutateAsync({
        id: 'booking-1',
        status: 'cancelled',
      })

      expect(bookingService.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'cancelled')
    })

    it('updates status to completed', async () => {
      const completedBooking = { ...mockBooking, status: 'completed' as const }
      vi.mocked(bookingService.updateBookingStatus).mockResolvedValue(completedBooking)

      const { result } = renderHook(() => useUpdateBookingStatus())

      await result.current.mutateAsync({
        id: 'booking-1',
        status: 'completed',
      })

      expect(bookingService.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'completed')
    })
  })

  // ============================================
  // VIP Ticket Export Hooks
  // ============================================

  describe('useVipTicketsForExport', () => {
    it('fetches VIP tickets for export', async () => {
      vi.mocked(bookingService.getVipTicketsForExport).mockResolvedValue([mockVipBooking])

      const { result } = renderHook(() => useVipTicketsForExport())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([mockVipBooking])
      expect(bookingService.getVipTicketsForExport).toHaveBeenCalled()
    })
  })

  describe('useMarkVipTicketsAsExported', () => {
    it('marks tickets as exported and invalidates cache', async () => {
      vi.mocked(bookingService.markVipTicketsAsExported).mockResolvedValue(undefined)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useMarkVipTicketsAsExported(), { queryClient })

      await result.current.mutateAsync(['booking-1', 'booking-2'])

      expect(bookingService.markVipTicketsAsExported).toHaveBeenCalledWith(['booking-1', 'booking-2'])
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vip-tickets-export'] })
    })

    it('handles empty array', async () => {
      vi.mocked(bookingService.markVipTicketsAsExported).mockResolvedValue(undefined)

      const { result } = renderHook(() => useMarkVipTicketsAsExported())

      await result.current.mutateAsync([])

      expect(bookingService.markVipTicketsAsExported).toHaveBeenCalledWith([])
    })
  })

  // ============================================
  // Query Key Tests
  // ============================================

  describe('query keys', () => {
    it('useBookings uses correct query key structure', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const queryClient = createTestQueryClient()
      renderHook(() => useBookings({ status: 'confirmed' }), { queryClient })

      await waitFor(() => {
        expect(bookingService.getBookings).toHaveBeenCalled()
      })

      const queries = queryClient.getQueryCache().findAll()
      const bookingsQuery = queries.find((q) => q.queryKey[0] === 'bookings')
      expect(bookingsQuery).toBeDefined()
      expect(bookingsQuery?.queryKey).toContain('all') // selectedVenue
    })

    it('useBooking uses correct query key', async () => {
      vi.mocked(bookingService.getBooking).mockResolvedValue(mockBooking)

      const queryClient = createTestQueryClient()
      renderHook(() => useBooking('booking-123'), { queryClient })

      await waitFor(() => {
        expect(bookingService.getBooking).toHaveBeenCalled()
      })

      const queryState = queryClient.getQueryState(['booking', 'booking-123'])
      expect(queryState).toBeDefined()
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('handles empty bookings list', async () => {
      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const { result } = renderHook(() => useBookings())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })

    it('handles multiple rapid mutations', async () => {
      vi.mocked(bookingService.updateBookingStatus).mockImplementation(async (id, status) => ({
        ...mockBooking,
        id,
        status: status as 'pending' | 'confirmed' | 'cancelled' | 'completed',
      }))

      const { result } = renderHook(() => useUpdateBookingStatus())

      // Fire multiple mutations
      await Promise.all([
        result.current.mutateAsync({ id: 'b1', status: 'confirmed' }),
        result.current.mutateAsync({ id: 'b2', status: 'cancelled' }),
        result.current.mutateAsync({ id: 'b3', status: 'completed' }),
      ])

      expect(bookingService.updateBookingStatus).toHaveBeenCalledTimes(3)
    })
  })
})
