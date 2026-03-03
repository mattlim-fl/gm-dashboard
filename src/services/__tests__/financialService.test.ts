import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { financialService } from '../financialService'
import { supabase } from '@/integrations/supabase/client'
import { fetchPnl } from '../xeroService'
import { bookingService } from '../bookingService'

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

vi.mock('../xeroService', () => ({
  fetchPnl: vi.fn(),
}))

vi.mock('../bookingService', () => ({
  bookingService: {
    getBookings: vi.fn(),
  },
}))

describe('financialService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use a fixed date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  // ============================================
  // getRevenueForPeriod Tests
  // ============================================

  describe('getRevenueForPeriod', () => {
    it('returns revenue from RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 500000, // 5000 dollars in cents
        error: null,
      } as never)

      const result = await financialService.getRevenueForPeriod(
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )

      expect(result).toBe(500000)
      expect(supabase.rpc).toHaveBeenCalledWith('get_revenue_sum', {
        start_date: new Date('2024-06-01').toISOString(),
        end_date: new Date('2024-06-15').toISOString(),
        venue_filter: null,
      })
    })

    it('returns 0 on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      } as never)

      const result = await financialService.getRevenueForPeriod(
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )

      expect(result).toBe(0)
    })

    it('returns 0 when data is null', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as never)

      const result = await financialService.getRevenueForPeriod(
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )

      expect(result).toBe(0)
    })
  })

  // ============================================
  // getAttendanceForPeriod Tests
  // ============================================

  describe('getAttendanceForPeriod', () => {
    it('returns attendance from RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 1500,
        error: null,
      } as never)

      const result = await financialService.getAttendanceForPeriod(
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )

      expect(result).toBe(1500)
      expect(supabase.rpc).toHaveBeenCalledWith('get_attendance_sum', {
        start_date: new Date('2024-06-01').toISOString(),
        end_date: new Date('2024-06-15').toISOString(),
        venue_filter: null,
      })
    })

    it('returns 0 on error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      } as never)

      const result = await financialService.getAttendanceForPeriod(
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )

      expect(result).toBe(0)
    })
  })

  // ============================================
  // fetchWeeklyFinancials Tests
  // ============================================

  describe('fetchWeeklyFinancials', () => {
    it('fetches and combines revenue and cost data', async () => {
      // Mock weekly revenue data
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { week_start: '2024-06-10T00:00:00Z', total_revenue_cents: 1100000 }, // $10000 + GST
          { week_start: '2024-06-03T00:00:00Z', total_revenue_cents: 880000 },  // $8000 + GST
        ],
        error: null,
      } as never)

      // Mock Xero P&L data for each week
      vi.mocked(fetchPnl)
        .mockResolvedValueOnce({
          categories: { wages: 2000, cogs: 1500, security: 500 },
          totals: { expenses: 5000 },
        } as never)
        .mockResolvedValueOnce({
          categories: { wages: 1800, cogs: 1400, security: 450 },
          totals: { expenses: 4500 },
        } as never)

      const result = await financialService.fetchWeeklyFinancials(2)

      expect(result).toHaveLength(2)
      // Results should be oldest first
      expect(result[0].weekStart).toBe('2024-06-03')
      expect(result[1].weekStart).toBe('2024-06-10')
    })

    it('handles missing Xero data gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { week_start: '2024-06-10T00:00:00Z', total_revenue_cents: 1100000 },
        ],
        error: null,
      } as never)

      // Xero returns error
      vi.mocked(fetchPnl).mockRejectedValue(new Error('Xero unavailable'))

      const result = await financialService.fetchWeeklyFinancials(1)

      expect(result).toHaveLength(1)
      // Should still have revenue data
      expect(result[0].wages).toBe(0)
      expect(result[0].cogs).toBe(0)
    })

    it('throws error when revenue fetch fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as never)

      await expect(financialService.fetchWeeklyFinancials(2)).rejects.toThrow(
        'Failed to fetch revenue data'
      )
    })

    it('calculates net profit and margin correctly', async () => {
      // Revenue: $11000 cents = $110 dollars, GST-exclusive = $100
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { week_start: '2024-06-10T00:00:00Z', total_revenue_cents: 11000 },
        ],
        error: null,
      } as never)

      vi.mocked(fetchPnl).mockResolvedValue({
        categories: { wages: 30, cogs: 20, security: 10 },
        totals: { expenses: 70 },
      } as never)

      const result = await financialService.fetchWeeklyFinancials(1)

      // Revenue: 11000 cents / 100 / 1.1 = $100 GST-exclusive
      expect(result[0].revenue).toBeCloseTo(100, 1)
      // Net profit: $100 - $70 = $30
      expect(result[0].netProfit).toBeCloseTo(30, 1)
      // Margin: 30/100 * 100 = 30%
      expect(result[0].marginPercent).toBeCloseTo(30, 1)
    })

    it('calculates other expenses correctly', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { week_start: '2024-06-10T00:00:00Z', total_revenue_cents: 11000 },
        ],
        error: null,
      } as never)

      vi.mocked(fetchPnl).mockResolvedValue({
        categories: { wages: 30, cogs: 20, security: 10, marketing: 5 },
        totals: { expenses: 100 },
      } as never)

      const result = await financialService.fetchWeeklyFinancials(1)

      // Other expenses: 100 - (30 + 20 + 10 + 5) = 35
      expect(result[0].otherExpenses).toBe(35)
    })
  })

  // ============================================
  // fetchKPIs Tests
  // ============================================

  describe('fetchKPIs', () => {
    beforeEach(() => {
      // Mock all RPC calls
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: 1100000, error: null } as never) // current revenue (cents)
        .mockResolvedValueOnce({ data: 1000000, error: null } as never) // previous revenue
        .mockResolvedValueOnce({ data: 500, error: null } as never) // current attendance
        .mockResolvedValueOnce({ data: 450, error: null } as never) // previous attendance

      // Mock Xero P&L
      vi.mocked(fetchPnl)
        .mockResolvedValueOnce({
          categories: { wages: 2000, cogs: 1500, security: 500 },
          totals: { expenses: 5000 },
        } as never)
        .mockResolvedValueOnce({
          categories: { wages: 1800, cogs: 1400, security: 450 },
          totals: { expenses: 4500 },
        } as never)

      // Mock bookings
      vi.mocked(bookingService.getBookings)
        .mockResolvedValueOnce([
          { booking_type: 'vip_tickets' },
          { booking_type: 'vip_tickets' },
          { booking_type: 'karaoke_booking' },
          { booking_type: 'venue_hire' },
        ] as never)
        .mockResolvedValueOnce([
          { booking_type: 'vip_tickets' },
          { booking_type: 'karaoke_booking' },
        ] as never)
    })

    it('calculates revenue KPIs', async () => {
      const result = await financialService.fetchKPIs(28)

      // Current: 1100000 cents / 100 / 1.1 = $10000 GST-exclusive
      expect(result.revenue.total).toBeCloseTo(10000, 0)
      // Previous: 1000000 cents / 100 / 1.1 = ~$9090.91
      expect(result.revenue.previousTotal).toBeCloseTo(9090.91, 0)
      // Change: (10000 - 9090.91) / 9090.91 * 100 = ~10%
      expect(result.revenue.changePercent).toBeCloseTo(10, 0)
    })

    it('calculates attendance KPIs', async () => {
      const result = await financialService.fetchKPIs(28)

      expect(result.attendance.total).toBe(500)
      expect(result.attendance.previousTotal).toBe(450)
      // Change: (500 - 450) / 450 * 100 = 11.11%
      expect(result.attendance.changePercent).toBeCloseTo(11.11, 1)
    })

    it('calculates spend per head', async () => {
      const result = await financialService.fetchKPIs(28)

      // Current: $10000 / 500 = $20 per head
      expect(result.spendPerHead.total).toBeCloseTo(20, 0)
      // Previous: ~$9090.91 / 450 = ~$20.20 per head
      expect(result.spendPerHead.previousTotal).toBeCloseTo(20.20, 0)
    })

    it('calculates wage percentage of revenue', async () => {
      const result = await financialService.fetchKPIs(28)

      // Wages: $2000, Revenue: ~$10000
      // Wage %: 2000 / 10000 * 100 = 20%
      expect(result.wages.percentOfRevenue).toBeCloseTo(20, 0)
    })

    it('calculates booking breakdown', async () => {
      const result = await financialService.fetchKPIs(28)

      expect(result.bookings.total).toBe(4)
      expect(result.bookings.breakdown.tickets).toBe(2)
      expect(result.bookings.breakdown.karaoke).toBe(1)
      expect(result.bookings.breakdown.venueHire).toBe(1)
      // Change: (4 - 2) / 2 * 100 = 100%
      expect(result.bookings.changePercent).toBe(100)
    })

    it('handles zero attendance correctly', async () => {
      vi.mocked(supabase.rpc)
        .mockReset()
        .mockResolvedValueOnce({ data: 1100000, error: null } as never)
        .mockResolvedValueOnce({ data: 1000000, error: null } as never)
        .mockResolvedValueOnce({ data: 0, error: null } as never) // zero attendance
        .mockResolvedValueOnce({ data: 0, error: null } as never)

      vi.mocked(fetchPnl).mockResolvedValue({
        categories: {},
        totals: { expenses: 0 },
      } as never)

      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const result = await financialService.fetchKPIs(28)

      // Spend per head should be 0 when attendance is 0
      expect(result.spendPerHead.total).toBe(0)
      expect(result.spendPerHead.changePercent).toBe(0)
    })

    it('handles zero previous revenue correctly', async () => {
      vi.mocked(supabase.rpc)
        .mockReset()
        .mockResolvedValueOnce({ data: 1100000, error: null } as never)
        .mockResolvedValueOnce({ data: 0, error: null } as never) // zero previous
        .mockResolvedValueOnce({ data: 500, error: null } as never)
        .mockResolvedValueOnce({ data: 0, error: null } as never)

      vi.mocked(fetchPnl).mockResolvedValue({
        categories: {},
        totals: { expenses: 0 },
      } as never)

      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const result = await financialService.fetchKPIs(28)

      // Revenue change should be 0 when previous is 0
      expect(result.revenue.changePercent).toBe(0)
    })

    it('handles Xero fetch errors', async () => {
      vi.mocked(fetchPnl).mockReset().mockRejectedValue(new Error('Xero unavailable'))

      const result = await financialService.fetchKPIs(28)

      // Should still return results with 0 expenses
      expect(result.wages.total).toBe(0)
      expect(result.cogs.total).toBe(0)
      expect(result.security.total).toBe(0)
    })

    it('calculates net profit correctly', async () => {
      const result = await financialService.fetchKPIs(28)

      // Revenue: ~$10000, Expenses: $5000
      // Net Profit: ~$10000 - $5000 = ~$5000
      expect(result.netProfit.total).toBeCloseTo(5000, 0)
      // Margin: 5000 / 10000 * 100 = 50%
      expect(result.netProfit.marginPercent).toBeCloseTo(50, 0)
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('handles all zeros gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 0,
        error: null,
      } as never)

      vi.mocked(fetchPnl).mockResolvedValue({
        categories: {},
        totals: { expenses: 0 },
      } as never)

      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const result = await financialService.fetchKPIs(28)

      expect(result.revenue.total).toBe(0)
      expect(result.netProfit.marginPercent).toBe(0)
      expect(result.spendPerHead.total).toBe(0)
      expect(result.bookings.total).toBe(0)
    })

    it('handles negative net profit (loss)', async () => {
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: 100000, error: null } as never) // $1000 revenue (cents)
        .mockResolvedValueOnce({ data: 100000, error: null } as never)
        .mockResolvedValueOnce({ data: 100, error: null } as never)
        .mockResolvedValueOnce({ data: 100, error: null } as never)

      // Expenses exceed revenue
      vi.mocked(fetchPnl).mockResolvedValue({
        categories: { wages: 1000 },
        totals: { expenses: 2000 }, // More than revenue
      } as never)

      vi.mocked(bookingService.getBookings).mockResolvedValue([])

      const result = await financialService.fetchKPIs(28)

      // Revenue: $1000 cents / 100 / 1.1 = ~$909
      // Net Profit: ~$909 - $2000 = ~-$1091
      expect(result.netProfit.total).toBeLessThan(0)
    })
  })
})
