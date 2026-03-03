import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHook, createTestQueryClient } from '@/test/utils/renderHook'
import {
  useKaraokeBooths,
  useKaraokeBooth,
  useCreateKaraokeBooth,
  useUpdateKaraokeBooth,
  useToggleBoothAvailability,
  useArchiveBooth,
  useRestoreBooth,
  useCreateKaraokeBooking,
  useBoothAvailability,
  useCheckBookingConflicts,
  useTimeSlots,
  useValidateBookingTime,
  useCalculateBookingCost,
  useKaraokeAvailability,
  useCreateKaraokeHold,
  useExtendKaraokeHold,
  useReleaseKaraokeHold,
  useFinalizeKaraokeHold,
  useActiveKaraokeHolds,
  useStaffReleaseKaraokeHold,
  useBoothManagement,
} from '../useKaraoke'
import { karaokeService } from '@/services/karaokeService'

// Mock karaokeService
vi.mock('@/services/karaokeService', () => ({
  karaokeService: {
    getKaraokeBooths: vi.fn(),
    getKaraokeBooth: vi.fn(),
    createKaraokeBooth: vi.fn(),
    updateKaraokeBooth: vi.fn(),
    toggleBoothAvailability: vi.fn(),
    archiveBooth: vi.fn(),
    restoreBooth: vi.fn(),
    createKaraokeBooking: vi.fn(),
    getBoothAvailability: vi.fn(),
    checkBookingConflicts: vi.fn(),
    generateTimeSlots: vi.fn(),
    validateBookingTime: vi.fn(),
    calculateBookingCost: vi.fn(),
    getAvailability: vi.fn(),
    createHold: vi.fn(),
    extendHold: vi.fn(),
    releaseHold: vi.fn(),
    finalizeHold: vi.fn(),
    getActiveHolds: vi.fn(),
    staffReleaseHold: vi.fn(),
  },
}))

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockBooth = {
  id: 'booth-1',
  name: 'Booth 1',
  venue: 'manor' as const,
  capacity: 10,
  hourly_rate_cents: 5000,
  is_available: true,
  is_archived: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockBooking = {
  id: 'booking-1',
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  venue: 'manor' as const,
  booking_date: '2024-06-15',
  booking_type: 'karaoke_booking' as const,
  status: 'confirmed' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('useKaraoke hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // Booth Query Hooks
  // ============================================

  describe('useKaraokeBooths', () => {
    it('returns loading state initially', () => {
      vi.mocked(karaokeService.getKaraokeBooths).mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useKaraokeBooths())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('returns booths after loading', async () => {
      vi.mocked(karaokeService.getKaraokeBooths).mockResolvedValue([mockBooth])

      const { result } = renderHook(() => useKaraokeBooths())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([mockBooth])
    })

    it('passes filters to service', async () => {
      vi.mocked(karaokeService.getKaraokeBooths).mockResolvedValue([mockBooth])

      renderHook(() => useKaraokeBooths({ venue: 'manor', is_available: true }))

      await waitFor(() => {
        expect(karaokeService.getKaraokeBooths).toHaveBeenCalledWith({
          venue: 'manor',
          is_available: true,
        })
      })
    })
  })

  describe('useKaraokeBooth', () => {
    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useKaraokeBooth(''))

      expect(result.current.isLoading).toBe(false)
      expect(karaokeService.getKaraokeBooth).not.toHaveBeenCalled()
    })

    it('fetches booth by id', async () => {
      vi.mocked(karaokeService.getKaraokeBooth).mockResolvedValue(mockBooth)

      const { result } = renderHook(() => useKaraokeBooth('booth-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockBooth)
      expect(karaokeService.getKaraokeBooth).toHaveBeenCalledWith('booth-1')
    })
  })

  // ============================================
  // Booth Mutation Hooks
  // ============================================

  describe('useCreateKaraokeBooth', () => {
    it('creates booth and invalidates cache', async () => {
      vi.mocked(karaokeService.createKaraokeBooth).mockResolvedValue(mockBooth)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCreateKaraokeBooth(), { queryClient })

      await result.current.mutateAsync({
        name: 'New Booth',
        venue: 'manor',
        capacity: 10,
        hourly_rate_cents: 5000,
      })

      expect(karaokeService.createKaraokeBooth).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['karaoke-booths'] })
    })
  })

  describe('useUpdateKaraokeBooth', () => {
    it('updates booth and invalidates cache', async () => {
      vi.mocked(karaokeService.updateKaraokeBooth).mockResolvedValue(mockBooth)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useUpdateKaraokeBooth(), { queryClient })

      await result.current.mutateAsync({
        id: 'booth-1',
        data: { name: 'Updated Booth' },
      })

      expect(karaokeService.updateKaraokeBooth).toHaveBeenCalledWith('booth-1', { name: 'Updated Booth' })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['karaoke-booths'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['karaoke-booth', 'booth-1'] })
    })
  })

  describe('useToggleBoothAvailability', () => {
    it('toggles availability', async () => {
      vi.mocked(karaokeService.toggleBoothAvailability).mockResolvedValue({
        ...mockBooth,
        is_available: false,
      })

      const { result } = renderHook(() => useToggleBoothAvailability())

      await result.current.mutateAsync({ id: 'booth-1', isAvailable: false })

      expect(karaokeService.toggleBoothAvailability).toHaveBeenCalledWith('booth-1', false)
    })
  })

  describe('useArchiveBooth', () => {
    it('archives booth', async () => {
      vi.mocked(karaokeService.archiveBooth).mockResolvedValue({
        ...mockBooth,
        is_archived: true,
      })

      const { result } = renderHook(() => useArchiveBooth())

      await result.current.mutateAsync('booth-1')

      expect(karaokeService.archiveBooth).toHaveBeenCalledWith('booth-1')
    })
  })

  describe('useRestoreBooth', () => {
    it('restores booth', async () => {
      vi.mocked(karaokeService.restoreBooth).mockResolvedValue({
        ...mockBooth,
        is_archived: false,
      })

      const { result } = renderHook(() => useRestoreBooth())

      await result.current.mutateAsync('booth-1')

      expect(karaokeService.restoreBooth).toHaveBeenCalledWith('booth-1')
    })
  })

  // ============================================
  // Booking Hooks
  // ============================================

  describe('useCreateKaraokeBooking', () => {
    it('creates booking and invalidates cache', async () => {
      vi.mocked(karaokeService.createKaraokeBooking).mockResolvedValue(mockBooking)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCreateKaraokeBooking(), { queryClient })

      await result.current.mutateAsync({
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venue: 'manor',
        bookingDate: '2024-06-15',
        boothId: 'booth-1',
        startTime: '18:00',
        endTime: '20:00',
      })

      expect(karaokeService.createKaraokeBooking).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['karaoke-bookings'] })
    })
  })

  // ============================================
  // Availability Hooks
  // ============================================

  describe('useBoothAvailability', () => {
    it('does not fetch when params are missing', () => {
      const { result } = renderHook(() => useBoothAvailability('', ''))

      expect(result.current.isLoading).toBe(false)
      expect(karaokeService.getBoothAvailability).not.toHaveBeenCalled()
    })

    it('fetches availability for booth and date', async () => {
      const mockAvailability = { available: true, slots: [] }
      vi.mocked(karaokeService.getBoothAvailability).mockResolvedValue(mockAvailability)

      const { result } = renderHook(() => useBoothAvailability('booth-1', '2024-06-15'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(karaokeService.getBoothAvailability).toHaveBeenCalledWith('booth-1', '2024-06-15')
    })
  })

  describe('useCheckBookingConflicts', () => {
    it('checks for conflicts', async () => {
      vi.mocked(karaokeService.checkBookingConflicts).mockResolvedValue({ hasConflict: false })

      const { result } = renderHook(() => useCheckBookingConflicts())

      await result.current.mutateAsync({
        booth_id: 'booth-1',
        date: '2024-06-15',
        start_time: '18:00',
        end_time: '20:00',
      })

      expect(karaokeService.checkBookingConflicts).toHaveBeenCalled()
    })
  })

  // ============================================
  // Utility Hooks
  // ============================================

  describe('useTimeSlots', () => {
    it('generates time slots', async () => {
      const mockSlots = ['10:00', '11:00', '12:00']
      vi.mocked(karaokeService.generateTimeSlots).mockResolvedValue(mockSlots)

      const { result } = renderHook(() => useTimeSlots(10, 12))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(karaokeService.generateTimeSlots).toHaveBeenCalledWith(10, 12)
    })

    it('uses default hours', async () => {
      vi.mocked(karaokeService.generateTimeSlots).mockResolvedValue([])

      renderHook(() => useTimeSlots())

      await waitFor(() => {
        expect(karaokeService.generateTimeSlots).toHaveBeenCalledWith(10, 23)
      })
    })
  })

  describe('useValidateBookingTime', () => {
    it('validates booking times', async () => {
      vi.mocked(karaokeService.validateBookingTime).mockReturnValue({ valid: true })

      const { result } = renderHook(() => useValidateBookingTime())

      const validation = await result.current.mutateAsync({
        startTime: '18:00',
        endTime: '20:00',
      })

      expect(validation).toEqual({ valid: true })
      expect(karaokeService.validateBookingTime).toHaveBeenCalledWith('18:00', '20:00')
    })
  })

  describe('useCalculateBookingCost', () => {
    it('calculates booking cost', async () => {
      vi.mocked(karaokeService.calculateBookingCost).mockReturnValue({ hours: 2, totalCents: 10000 })

      const { result } = renderHook(() => useCalculateBookingCost())

      const cost = await result.current.mutateAsync({
        startTime: '18:00',
        endTime: '20:00',
        hourlyRate: 5000,
      })

      expect(cost).toEqual({ hours: 2, totalCents: 10000 })
    })
  })

  // ============================================
  // Edge Function Hooks
  // ============================================

  describe('useKaraokeAvailability', () => {
    it('fetches availability from edge function', async () => {
      const mockData = { booths: [], slots: [] }
      vi.mocked(karaokeService.getAvailability).mockResolvedValue(mockData)

      const { result } = renderHook(() =>
        useKaraokeAvailability({
          venue: 'manor',
          bookingDate: '2024-06-15',
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(karaokeService.getAvailability).toHaveBeenCalled()
    })
  })

  // ============================================
  // Hold Management Hooks
  // ============================================

  describe('useCreateKaraokeHold', () => {
    it('creates hold', async () => {
      const mockHold = { holdId: 'hold-1', expiresAt: '2024-06-15T18:15:00Z' }
      vi.mocked(karaokeService.createHold).mockResolvedValue(mockHold)

      const { result } = renderHook(() => useCreateKaraokeHold())

      await result.current.mutateAsync({
        boothId: 'booth-1',
        venue: 'manor',
        bookingDate: '2024-06-15',
        startTime: '18:00',
        endTime: '20:00',
        sessionId: 'session-1',
      })

      expect(karaokeService.createHold).toHaveBeenCalled()
    })
  })

  describe('useExtendKaraokeHold', () => {
    it('extends hold', async () => {
      vi.mocked(karaokeService.extendHold).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useExtendKaraokeHold())

      await result.current.mutateAsync({
        holdId: 'hold-1',
        sessionId: 'session-1',
      })

      expect(karaokeService.extendHold).toHaveBeenCalled()
    })
  })

  describe('useReleaseKaraokeHold', () => {
    it('releases hold', async () => {
      vi.mocked(karaokeService.releaseHold).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useReleaseKaraokeHold())

      await result.current.mutateAsync({
        holdId: 'hold-1',
        sessionId: 'session-1',
      })

      expect(karaokeService.releaseHold).toHaveBeenCalled()
    })
  })

  describe('useFinalizeKaraokeHold', () => {
    it('finalizes hold and creates booking', async () => {
      vi.mocked(karaokeService.finalizeHold).mockResolvedValue(mockBooking)

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useFinalizeKaraokeHold(), { queryClient })

      await result.current.mutateAsync({
        holdId: 'hold-1',
        sessionId: 'session-1',
        customerName: 'John Doe',
      })

      expect(karaokeService.finalizeHold).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
    })
  })

  describe('useActiveKaraokeHolds', () => {
    it('fetches active holds', async () => {
      const mockHolds = [{ holdId: 'hold-1', boothId: 'booth-1' }]
      vi.mocked(karaokeService.getActiveHolds).mockResolvedValue(mockHolds)

      const { result } = renderHook(() =>
        useActiveKaraokeHolds({
          boothId: 'booth-1',
          bookingDate: '2024-06-15',
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(karaokeService.getActiveHolds).toHaveBeenCalled()
    })
  })

  describe('useStaffReleaseKaraokeHold', () => {
    it('staff releases hold', async () => {
      vi.mocked(karaokeService.staffReleaseHold).mockResolvedValue({ success: true })

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useStaffReleaseKaraokeHold(), { queryClient })

      await result.current.mutateAsync('hold-1')

      expect(karaokeService.staffReleaseHold).toHaveBeenCalledWith('hold-1')
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['karaoke-holds'] })
    })
  })

  // ============================================
  // Combined Hooks
  // ============================================

  describe('useBoothManagement', () => {
    it('provides all booth management mutations', () => {
      const { result } = renderHook(() => useBoothManagement())

      expect(result.current.createBooth).toBeDefined()
      expect(result.current.updateBooth).toBeDefined()
      expect(result.current.toggleAvailability).toBeDefined()
      expect(result.current.archiveBooth).toBeDefined()
      expect(result.current.restoreBooth).toBeDefined()
      expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('returns combined loading state', async () => {
      vi.mocked(karaokeService.createKaraokeBooth).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockBooth), 100))
      )

      const { result } = renderHook(() => useBoothManagement())

      expect(result.current.isLoading).toBe(false)

      result.current.createBooth.mutate({
        name: 'Test',
        venue: 'manor',
        capacity: 10,
        hourly_rate_cents: 5000,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
