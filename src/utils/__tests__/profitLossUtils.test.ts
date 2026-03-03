import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatCurrency,
  formatPercentage,
  formatChangeIndicator,
  calculateMargin,
  calculateGrowthRate,
  groupAccountsByCategory,
  groupAccountsBySubcategory,
  sortAccountsByAmount,
  calculatePeriodDates,
  formatPeriodLabel,
  getCategoryDisplayName,
  getSubcategoryDisplayName,
  getProfitLossColors,
  validateProfitLossData,
} from '../profitLossUtils'

describe('formatCurrency (P&L version)', () => {
  it('formats cents to dollars', () => {
    expect(formatCurrency(10000)).toBe('$100')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats large amounts with separators', () => {
    expect(formatCurrency(123456789)).toBe('$1,234,568')
  })

  it('handles negative amounts', () => {
    expect(formatCurrency(-10000)).toBe('-$100')
  })

  it('handles small cent amounts', () => {
    expect(formatCurrency(50)).toBe('$1')
  })
})

describe('formatPercentage', () => {
  it('formats with 1 decimal by default', () => {
    // Note: toFixed uses banker's rounding, 5.55 -> '5.5'
    expect(formatPercentage(5.55)).toBe('5.5%')
    expect(formatPercentage(5.56)).toBe('5.6%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercentage(5.555, 2)).toBe('5.55%')
    expect(formatPercentage(5.556, 2)).toBe('5.56%')
  })

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0.0%')
  })

  it('handles negative percentages', () => {
    expect(formatPercentage(-15.5)).toBe('-15.5%')
  })

  it('handles whole numbers', () => {
    expect(formatPercentage(100, 0)).toBe('100%')
  })
})

describe('formatChangeIndicator', () => {
  describe('with percentage', () => {
    it('formats positive percentage with arrow', () => {
      const result = formatChangeIndicator(5.5, true, true)
      expect(result.value).toBe('↗5.5%')
      expect(result.color).toBe('text-green-600')
      expect(result.isPositive).toBe(true)
    })

    it('formats negative percentage with arrow', () => {
      const result = formatChangeIndicator(-3.2, true, true)
      expect(result.value).toBe('↘3.2%')
      expect(result.color).toBe('text-red-600')
      expect(result.isPositive).toBe(false)
    })

    it('formats zero as positive', () => {
      const result = formatChangeIndicator(0, true, true)
      expect(result.value).toBe('↗0.0%')
      expect(result.isPositive).toBe(true)
    })
  })

  describe('with currency', () => {
    it('formats positive currency change', () => {
      const result = formatChangeIndicator(10000, false, true)
      expect(result.value).toBe('↗$100')
      expect(result.color).toBe('text-green-600')
    })

    it('formats negative currency change', () => {
      const result = formatChangeIndicator(-5000, false, true)
      expect(result.value).toBe('↘$50')
      expect(result.color).toBe('text-red-600')
    })
  })

  describe('without arrow', () => {
    it('formats without arrow when showArrow is false', () => {
      const result = formatChangeIndicator(5.5, true, false)
      expect(result.value).toBe('5.5%')
    })

    it('formats currency without arrow', () => {
      const result = formatChangeIndicator(10000, false, false)
      expect(result.value).toBe('$100')
    })
  })
})

describe('calculateMargin', () => {
  it('calculates margin correctly', () => {
    // $20 profit on $100 revenue = 20%
    expect(calculateMargin(20, 100)).toBe(20)
  })

  it('handles zero revenue', () => {
    expect(calculateMargin(50, 0)).toBe(0)
  })

  it('handles zero profit', () => {
    expect(calculateMargin(0, 100)).toBe(0)
  })

  it('handles negative profit (loss)', () => {
    expect(calculateMargin(-20, 100)).toBe(-20)
  })

  it('handles high margin', () => {
    expect(calculateMargin(80, 100)).toBe(80)
  })
})

describe('calculateGrowthRate', () => {
  it('calculates positive growth', () => {
    // 120 from 100 = 20% growth
    expect(calculateGrowthRate(120, 100)).toBe(20)
  })

  it('calculates negative growth', () => {
    // 80 from 100 = -20% growth
    expect(calculateGrowthRate(80, 100)).toBe(-20)
  })

  it('handles zero previous', () => {
    expect(calculateGrowthRate(100, 0)).toBe(0)
  })

  it('handles doubling', () => {
    expect(calculateGrowthRate(200, 100)).toBe(100)
  })

  it('handles both zero', () => {
    expect(calculateGrowthRate(0, 0)).toBe(0)
  })
})

describe('groupAccountsByCategory', () => {
  const accounts = [
    { category: 'revenue', subcategory: 'bar', account_name: 'Bar Sales', amount_cents: 10000 },
    { category: 'revenue', subcategory: 'door', account_name: 'Door Sales', amount_cents: 5000 },
    { category: 'expenses', subcategory: 'staff', account_name: 'Wages', amount_cents: 3000 },
    { category: 'expenses', subcategory: 'rent', account_name: 'Rent', amount_cents: 2000 },
  ]

  it('groups accounts by category', () => {
    const grouped = groupAccountsByCategory(accounts)
    expect(Object.keys(grouped)).toEqual(['revenue', 'expenses'])
    expect(grouped['revenue']).toHaveLength(2)
    expect(grouped['expenses']).toHaveLength(2)
  })

  it('preserves account data in groups', () => {
    const grouped = groupAccountsByCategory(accounts)
    expect(grouped['revenue'][0].account_name).toBe('Bar Sales')
    expect(grouped['revenue'][0].amount_cents).toBe(10000)
  })

  it('handles empty array', () => {
    const grouped = groupAccountsByCategory([])
    expect(grouped).toEqual({})
  })

  it('handles single category', () => {
    const singleCategory = [
      { category: 'revenue', subcategory: 'bar', account_name: 'Bar', amount_cents: 1000 },
    ]
    const grouped = groupAccountsByCategory(singleCategory)
    expect(Object.keys(grouped)).toEqual(['revenue'])
  })
})

describe('groupAccountsBySubcategory', () => {
  const accounts = [
    { subcategory: 'bar_revenue', account_name: 'Drinks', amount_cents: 5000 },
    { subcategory: 'bar_revenue', account_name: 'Cocktails', amount_cents: 3000 },
    { subcategory: 'door_revenue', account_name: 'Tickets', amount_cents: 2000 },
  ]

  it('groups by subcategory with totals', () => {
    const grouped = groupAccountsBySubcategory(accounts)
    expect(grouped['bar_revenue'].total_cents).toBe(8000)
    expect(grouped['bar_revenue'].accounts).toHaveLength(2)
  })

  it('calculates separate totals for each subcategory', () => {
    const grouped = groupAccountsBySubcategory(accounts)
    expect(grouped['door_revenue'].total_cents).toBe(2000)
    expect(grouped['door_revenue'].accounts).toHaveLength(1)
  })

  it('handles empty array', () => {
    const grouped = groupAccountsBySubcategory([])
    expect(grouped).toEqual({})
  })
})

describe('sortAccountsByAmount', () => {
  const accounts = [
    { account_name: 'Small', amount_cents: 100 },
    { account_name: 'Large', amount_cents: 1000 },
    { account_name: 'Medium', amount_cents: 500 },
  ]

  it('sorts descending by default', () => {
    const sorted = sortAccountsByAmount(accounts)
    expect(sorted[0].account_name).toBe('Large')
    expect(sorted[1].account_name).toBe('Medium')
    expect(sorted[2].account_name).toBe('Small')
  })

  it('sorts ascending when specified', () => {
    const sorted = sortAccountsByAmount(accounts, false)
    expect(sorted[0].account_name).toBe('Small')
    expect(sorted[2].account_name).toBe('Large')
  })

  it('does not mutate original array', () => {
    const sorted = sortAccountsByAmount(accounts)
    expect(accounts[0].account_name).toBe('Small')
    expect(sorted[0].account_name).toBe('Large')
  })

  it('handles empty array', () => {
    const sorted = sortAccountsByAmount([])
    expect(sorted).toEqual([])
  })

  it('handles single item', () => {
    const single = [{ account_name: 'Only', amount_cents: 100 }]
    const sorted = sortAccountsByAmount(single)
    expect(sorted).toEqual(single)
  })
})

describe('calculatePeriodDates', () => {
  // Note: These tests check the relative behavior since exact dates
  // depend on local timezone and when the test runs.
  // The function uses local dates, not UTC.

  describe('month period', () => {
    it('returns valid date range for current month', () => {
      const result = calculatePeriodDates('month', 0)
      // Start should be first of month
      expect(result.startDate).toMatch(/^\d{4}-\d{2}-01$/)
      // End should be last day of month (28-31)
      expect(result.endDate).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/)
      // Start and end should be in same month
      expect(result.startDate.slice(0, 7)).toBe(result.endDate.slice(0, 7))
    })

    it('returns earlier month for offset=1', () => {
      const current = calculatePeriodDates('month', 0)
      const previous = calculatePeriodDates('month', 1)
      // Previous month should be before current month
      expect(new Date(previous.startDate) < new Date(current.startDate)).toBe(true)
    })

    it('includes a label', () => {
      const result = calculatePeriodDates('month', 0)
      // Should be something like "June 2024"
      expect(result.label).toMatch(/^\w+ \d{4}$/)
    })
  })

  describe('quarter period', () => {
    it('returns valid quarter date range', () => {
      const result = calculatePeriodDates('quarter', 0)
      const startMonth = parseInt(result.startDate.slice(5, 7))
      // Quarter starts on month 1, 4, 7, or 10
      expect([1, 4, 7, 10]).toContain(startMonth)
      // Start should be first of month
      expect(result.startDate).toMatch(/^\d{4}-\d{2}-01$/)
    })

    it('returns earlier quarter for offset=1', () => {
      const current = calculatePeriodDates('quarter', 0)
      const previous = calculatePeriodDates('quarter', 1)
      expect(new Date(previous.startDate) < new Date(current.startDate)).toBe(true)
    })

    it('includes quarter label', () => {
      const result = calculatePeriodDates('quarter', 0)
      // Should be something like "Q2 2024"
      expect(result.label).toMatch(/^Q[1-4] \d{4}$/)
    })
  })

  describe('year period', () => {
    it('returns full year date range', () => {
      const result = calculatePeriodDates('year', 0)
      // Start should be Jan 1
      expect(result.startDate).toMatch(/^\d{4}-01-01$/)
      // End should be Dec 31
      expect(result.endDate).toMatch(/^\d{4}-12-31$/)
    })

    it('returns previous year for offset=1', () => {
      const current = calculatePeriodDates('year', 0)
      const previous = calculatePeriodDates('year', 1)
      const currentYear = parseInt(current.startDate.slice(0, 4))
      const previousYear = parseInt(previous.startDate.slice(0, 4))
      expect(previousYear).toBe(currentYear - 1)
    })

    it('includes year label', () => {
      const result = calculatePeriodDates('year', 0)
      // Should be just the year "2024"
      expect(result.label).toMatch(/^\d{4}$/)
    })
  })
})

describe('formatPeriodLabel', () => {
  it('formats month label', () => {
    const startDate = new Date('2024-06-01')
    const endDate = new Date('2024-06-30')
    const label = formatPeriodLabel(startDate, endDate, 'month')
    expect(label).toBe('June 2024')
  })

  it('formats quarter label', () => {
    const startDate = new Date('2024-04-01')
    const endDate = new Date('2024-06-30')
    const label = formatPeriodLabel(startDate, endDate, 'quarter')
    expect(label).toBe('Q2 2024')
  })

  it('formats year label', () => {
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-12-31')
    const label = formatPeriodLabel(startDate, endDate, 'year')
    expect(label).toBe('2024')
  })

  it('formats Q1 correctly', () => {
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-03-31')
    expect(formatPeriodLabel(startDate, endDate, 'quarter')).toBe('Q1 2024')
  })

  it('formats Q4 correctly', () => {
    const startDate = new Date('2024-10-01')
    const endDate = new Date('2024-12-31')
    expect(formatPeriodLabel(startDate, endDate, 'quarter')).toBe('Q4 2024')
  })
})

describe('getCategoryDisplayName', () => {
  it('returns display name for known categories', () => {
    expect(getCategoryDisplayName('revenue')).toBe('Revenue')
    expect(getCategoryDisplayName('cost_of_sales')).toBe('Cost of Sales')
    expect(getCategoryDisplayName('operating_expenses')).toBe('Operating Expenses')
    expect(getCategoryDisplayName('other')).toBe('Other')
  })

  it('returns original for unknown category', () => {
    expect(getCategoryDisplayName('unknown_category')).toBe('unknown_category')
  })
})

describe('getSubcategoryDisplayName', () => {
  it('returns display name for known subcategories', () => {
    expect(getSubcategoryDisplayName('bar_revenue')).toBe('Bar Revenue')
    expect(getSubcategoryDisplayName('door_revenue')).toBe('Door Revenue')
    expect(getSubcategoryDisplayName('staff_costs')).toBe('Staff Costs')
    expect(getSubcategoryDisplayName('rent')).toBe('Rent & Lease')
    expect(getSubcategoryDisplayName('marketing')).toBe('Marketing & Advertising')
  })

  it('returns original for unknown subcategory', () => {
    expect(getSubcategoryDisplayName('custom_sub')).toBe('custom_sub')
  })
})

describe('getProfitLossColors', () => {
  it('returns all expected color classes', () => {
    const colors = getProfitLossColors()
    expect(colors.revenue).toBe('text-green-600')
    expect(colors.costOfSales).toBe('text-orange-600')
    expect(colors.grossProfit).toBe('text-blue-600')
    expect(colors.operatingExpenses).toBe('text-red-600')
    expect(colors.netProfit).toBe('text-purple-600')
    expect(colors.positive).toBe('text-green-600')
    expect(colors.negative).toBe('text-red-600')
    expect(colors.neutral).toBe('text-gray-600')
  })
})

describe('validateProfitLossData', () => {
  it('returns true for valid data', () => {
    const validData = {
      total_revenue_cents: 100000,
      cost_of_sales_cents: 30000,
      gross_profit_cents: 70000,
      operating_expenses_cents: 50000,
      net_profit_cents: 20000,
      accounts: [],
    }
    expect(validateProfitLossData(validData)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validateProfitLossData(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(validateProfitLossData(undefined)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validateProfitLossData('string')).toBe(false)
    expect(validateProfitLossData(123)).toBe(false)
    expect(validateProfitLossData([])).toBe(false)
  })

  it('returns false when missing required fields', () => {
    const missingField = {
      total_revenue_cents: 100000,
      cost_of_sales_cents: 30000,
      gross_profit_cents: 70000,
      // missing operating_expenses_cents
      net_profit_cents: 20000,
      accounts: [],
    }
    expect(validateProfitLossData(missingField)).toBe(false)
  })

  it('returns false when accounts is missing', () => {
    const noAccounts = {
      total_revenue_cents: 100000,
      cost_of_sales_cents: 30000,
      gross_profit_cents: 70000,
      operating_expenses_cents: 50000,
      net_profit_cents: 20000,
    }
    expect(validateProfitLossData(noAccounts)).toBe(false)
  })
})
