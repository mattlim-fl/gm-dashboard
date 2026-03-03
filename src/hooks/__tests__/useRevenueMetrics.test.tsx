import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHook, createTestQueryClient } from '@/test/utils/renderHook'
import { useRevenueMetrics } from '../useRevenueMetrics'
import { supabase } from '@/integrations/supabase/client'

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('useRevenueMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // Loading State Tests
  // ============================================

  describe('loading states', () => {
    it('returns loading state initially', () => {
      // Mock to never resolve
      vi.mocked(supabase.rpc).mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.dashboardData).toBeNull()
    })

    it('returns data after loading', async () => {
      // Mock successful RPC calls
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 100000,
        error: null,
      } as never)

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData).not.toBeNull()
    })
  })

  // ============================================
  // Data Structure Tests
  // ============================================

  describe('data structure', () => {
    beforeEach(() => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 110000,
        error: null,
      } as never)
    })

    it('returns weekly, monthly, and yearly metrics', async () => {
      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData).toHaveProperty('weekly')
      expect(result.current.dashboardData).toHaveProperty('monthly')
      expect(result.current.dashboardData).toHaveProperty('yearly')
    })

    it('returns correct metric shape', async () => {
      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const weeklyMetrics = result.current.dashboardData?.weekly
      expect(weeklyMetrics).toHaveProperty('current')
      expect(weeklyMetrics).toHaveProperty('previous')
      expect(weeklyMetrics).toHaveProperty('previousYear')
      expect(weeklyMetrics).toHaveProperty('currentFormatted')
      expect(weeklyMetrics).toHaveProperty('changePercent')
      expect(weeklyMetrics).toHaveProperty('currentAttendance')
      expect(weeklyMetrics).toHaveProperty('currentSpendPerHead')
    })

    it('formats currency values correctly', async () => {
      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const weeklyMetrics = result.current.dashboardData?.weekly
      expect(weeklyMetrics?.currentFormatted).toMatch(/\$/)
    })
  })

  // ============================================
  // Revenue Calculation Tests
  // ============================================

  describe('revenue calculations', () => {
    it('calculates change percent correctly', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        // Calls alternate: revenue then attendance for each period
        const cyclePosition = (callCount - 1) % 6

        if (cyclePosition === 0) return Promise.resolve({ data: 110000, error: null }) as never
        if (cyclePosition === 1) return Promise.resolve({ data: 100000, error: null }) as never
        if (cyclePosition === 2) return Promise.resolve({ data: 90000, error: null }) as never
        if (cyclePosition === 3) return Promise.resolve({ data: 100, error: null }) as never
        if (cyclePosition === 4) return Promise.resolve({ data: 90, error: null }) as never
        return Promise.resolve({ data: 80, error: null }) as never
      })

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Change percent: (110000 - 100000) / 100000 * 100 = 10%
      expect(result.current.dashboardData?.weekly.changePercent).toBeCloseTo(10, 1)
    })

    it('handles zero previous revenue', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        const cyclePosition = (callCount - 1) % 6

        if (cyclePosition === 0) return Promise.resolve({ data: 100000, error: null }) as never
        if (cyclePosition === 1) return Promise.resolve({ data: 0, error: null }) as never
        return Promise.resolve({ data: 0, error: null }) as never
      })

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData?.weekly.changePercent).toBe(0)
    })
  })

  // ============================================
  // Attendance and Spend Per Head Tests
  // ============================================

  describe('attendance and spend per head', () => {
    it('calculates spend per head correctly', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        const cyclePosition = (callCount - 1) % 6

        if (cyclePosition === 0) return Promise.resolve({ data: 100000, error: null }) as never
        if (cyclePosition === 3) return Promise.resolve({ data: 50, error: null }) as never
        return Promise.resolve({ data: 0, error: null }) as never
      })

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Spend per head: (100000 cents / 100) / 50 = $20
      expect(result.current.dashboardData?.weekly.currentSpendPerHead).toBeCloseTo(20, 1)
    })

    it('handles zero attendance', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        const cyclePosition = (callCount - 1) % 6

        if (cyclePosition === 0) return Promise.resolve({ data: 100000, error: null }) as never
        if (cyclePosition === 3) return Promise.resolve({ data: 0, error: null }) as never
        return Promise.resolve({ data: 0, error: null }) as never
      })

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData?.weekly.currentSpendPerHead).toBe(0)
    })

    it('formats spend per head correctly', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        const cyclePosition = (callCount - 1) % 6

        if (cyclePosition === 0) return Promise.resolve({ data: 100000, error: null }) as never
        if (cyclePosition === 3) return Promise.resolve({ data: 50, error: null }) as never
        return Promise.resolve({ data: 0, error: null }) as never
      })

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData?.weekly.currentSpendPerHeadFormatted).toMatch(/\$\d+\.\d{2}/)
    })
  })

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('returns empty metrics on RPC error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as never)

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData?.weekly.current).toBe(0)
    })

    it('handles null data gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as never)

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboardData?.weekly.current).toBe(0)
    })
  })

  // ============================================
  // Refetch Tests
  // ============================================

  describe('refetch', () => {
    it('provides refetch function', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 100000,
        error: null,
      } as never)

      const { result } = renderHook(() => useRevenueMetrics())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(typeof result.current.refetch).toBe('function')
    })

    it('refetch updates data', async () => {
      let callCount = 0
      vi.mocked(supabase.rpc).mockImplementation(() => {
        callCount++
        // First 6 calls (first fetch) return 100000
        // Subsequent calls return 200000
        if (callCount <= 6) {
          return Promise.resolve({ data: 100000, error: null }) as never
        }
        return Promise.resolve({ data: 200000, error: null }) as never
      })

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useRevenueMetrics(), { queryClient })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialRevenue = result.current.dashboardData?.weekly.current

      await result.current.refetch()

      await waitFor(() => {
        expect(result.current.dashboardData?.weekly.current).not.toBe(initialRevenue)
      })
    })
  })

  // ============================================
  // Query Configuration Tests
  // ============================================

  describe('query configuration', () => {
    it('uses correct query key', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 100000,
        error: null,
      } as never)

      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useRevenueMetrics(), { queryClient })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const queryState = queryClient.getQueryState(['revenue-metrics'])
      expect(queryState).toBeDefined()
    })
  })
})
