import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RevenueMetricCard } from '../RevenueMetricCard'

const createMetrics = (overrides = {}) => ({
  currentFormatted: '$5,000',
  currentAttendance: 250,
  currentSpendPerHeadFormatted: '$20.00',
  changePercent: 10,
  changePercentYear: 15,
  attendanceChangePercent: 5,
  attendanceChangePercentYear: 8,
  spendPerHeadChangePercent: 3,
  spendPerHeadChangePercentYear: 7,
  ...overrides,
})

describe('RevenueMetricCard', () => {
  const defaultProps = {
    title: 'This Saturday',
    metrics: createMetrics(),
    comparisonType: 'previous' as const,
  }

  // ============================================
  // Rendering Tests
  // ============================================

  describe('rendering', () => {
    it('renders card title', () => {
      render(<RevenueMetricCard {...defaultProps} />)

      expect(screen.getByText('This Saturday')).toBeInTheDocument()
    })

    it('renders revenue by default', () => {
      render(<RevenueMetricCard {...defaultProps} />)

      expect(screen.getByText('Revenue')).toBeInTheDocument()
      expect(screen.getByText('$5,000')).toBeInTheDocument()
    })

    it('does not render revenue when showRevenue is false', () => {
      render(<RevenueMetricCard {...defaultProps} showRevenue={false} />)

      expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
    })

    it('does not render attendance by default', () => {
      render(<RevenueMetricCard {...defaultProps} />)

      expect(screen.queryByText('Attendance')).not.toBeInTheDocument()
    })

    it('renders attendance when showAttendance is true', () => {
      render(<RevenueMetricCard {...defaultProps} showAttendance />)

      expect(screen.getByText('Attendance')).toBeInTheDocument()
      expect(screen.getByText('250')).toBeInTheDocument()
    })

    it('does not render spend per head by default', () => {
      render(<RevenueMetricCard {...defaultProps} />)

      expect(screen.queryByText('$ per Head')).not.toBeInTheDocument()
    })

    it('renders spend per head when showSpendPerHead is true', () => {
      render(<RevenueMetricCard {...defaultProps} showSpendPerHead />)

      expect(screen.getByText('$ per Head')).toBeInTheDocument()
      expect(screen.getByText('$20.00')).toBeInTheDocument()
    })
  })

  // ============================================
  // Comparison Type Tests
  // ============================================

  describe('comparison type', () => {
    it('shows "vs previous" when comparisonType is previous', () => {
      render(<RevenueMetricCard {...defaultProps} comparisonType="previous" />)

      expect(screen.getByText(/vs previous/)).toBeInTheDocument()
    })

    it('shows "vs last year" when comparisonType is year', () => {
      render(<RevenueMetricCard {...defaultProps} comparisonType="year" />)

      expect(screen.getByText(/vs last year/)).toBeInTheDocument()
    })

    it('uses changePercent for previous comparison', () => {
      const metrics = createMetrics({ changePercent: 10, changePercentYear: 20 })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="previous"
        />
      )

      // Should show 10% (changePercent)
      expect(screen.getByText(/10\.0%/)).toBeInTheDocument()
    })

    it('uses changePercentYear for year comparison', () => {
      const metrics = createMetrics({ changePercent: 10, changePercentYear: 20 })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="year"
        />
      )

      // Should show 20% (changePercentYear)
      expect(screen.getByText(/20\.0%/)).toBeInTheDocument()
    })
  })

  // ============================================
  // Trend Indicator Tests
  // ============================================

  describe('trend indicators', () => {
    it('shows positive change percent with correct formatting', () => {
      const metrics = createMetrics({ changePercent: 25.5 })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="previous"
        />
      )

      expect(screen.getByText(/25\.5%/)).toBeInTheDocument()
    })

    it('shows negative change percent with correct formatting', () => {
      const metrics = createMetrics({ changePercent: -15.3 })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="previous"
        />
      )

      expect(screen.getByText(/-15\.3%/)).toBeInTheDocument()
    })

    it('shows zero change percent', () => {
      const metrics = createMetrics({ changePercent: 0 })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="previous"
        />
      )

      expect(screen.getByText(/0\.0%/)).toBeInTheDocument()
    })
  })

  // ============================================
  // Multiple Metrics Tests
  // ============================================

  describe('multiple metrics', () => {
    it('renders all metrics when enabled', () => {
      render(
        <RevenueMetricCard
          {...defaultProps}
          showRevenue
          showAttendance
          showSpendPerHead
        />
      )

      expect(screen.getByText('Revenue')).toBeInTheDocument()
      expect(screen.getByText('Attendance')).toBeInTheDocument()
      expect(screen.getByText('$ per Head')).toBeInTheDocument()
    })

    it('shows attendance change percent for previous comparison', () => {
      const metrics = createMetrics({
        attendanceChangePercent: 12,
        attendanceChangePercentYear: 18,
      })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="previous"
          showAttendance
        />
      )

      // Should show 12% for attendance (attendanceChangePercent)
      const allPercentTexts = screen.getAllByText(/12\.0%/)
      expect(allPercentTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('shows spend per head change percent for year comparison', () => {
      const metrics = createMetrics({
        spendPerHeadChangePercent: 5,
        spendPerHeadChangePercentYear: 10,
      })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          comparisonType="year"
          showRevenue={false}
          showSpendPerHead
        />
      )

      // Should show 10% for spend per head (spendPerHeadChangePercentYear)
      expect(screen.getByText(/10\.0%/)).toBeInTheDocument()
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('handles missing attendance data gracefully', () => {
      const metrics = createMetrics({ currentAttendance: undefined })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          showAttendance
        />
      )

      // Should not render attendance section when data is undefined
      expect(screen.queryByText('Attendance')).not.toBeInTheDocument()
    })

    it('handles missing spend per head data gracefully', () => {
      const metrics = createMetrics({ currentSpendPerHeadFormatted: undefined })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          showSpendPerHead
        />
      )

      // Should not render spend per head section when data is missing
      expect(screen.queryByText('$ per Head')).not.toBeInTheDocument()
    })

    it('handles large numbers', () => {
      const metrics = createMetrics({
        currentFormatted: '$1,234,567',
        currentAttendance: 99999,
      })
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          showAttendance
        />
      )

      expect(screen.getByText('$1,234,567')).toBeInTheDocument()
      expect(screen.getByText('99,999')).toBeInTheDocument()
    })

    it('handles undefined optional change percents', () => {
      const metrics = {
        currentFormatted: '$5,000',
        changePercent: 10,
        changePercentYear: 15,
        // Optional fields are undefined
      }
      render(
        <RevenueMetricCard
          {...defaultProps}
          metrics={metrics}
          showAttendance
          showSpendPerHead
        />
      )

      // Should render without crashing
      expect(screen.getByText('Revenue')).toBeInTheDocument()
    })

    it('renders different titles correctly', () => {
      const titles = ['This Saturday', 'Last 4 Weeks', 'Year to Date']

      titles.forEach((title) => {
        const { unmount } = render(
          <RevenueMetricCard {...defaultProps} title={title} />
        )
        expect(screen.getByText(title)).toBeInTheDocument()
        unmount()
      })
    })
  })
})
