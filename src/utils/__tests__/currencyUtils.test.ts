import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatPercent,
  getPercentColor,
  calculatePercentChange,
  centsToDollars,
  dollarsToCents,
} from '../currencyUtils'

describe('formatCurrency', () => {
  describe('basic formatting', () => {
    it('formats dollars correctly with default options', () => {
      expect(formatCurrency(100)).toBe('$100')
    })

    it('formats large amounts with thousand separators', () => {
      expect(formatCurrency(1234567)).toBe('$1,234,567')
    })

    it('formats zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0')
    })
  })

  describe('null/undefined handling', () => {
    it('returns dash for null', () => {
      expect(formatCurrency(null)).toBe('-')
    })

    it('returns dash for undefined', () => {
      expect(formatCurrency(undefined)).toBe('-')
    })
  })

  describe('cents conversion', () => {
    it('converts cents to dollars when inputInCents is true', () => {
      expect(formatCurrency(10000, { inputInCents: true })).toBe('$100')
    })

    it('handles small cent amounts', () => {
      expect(formatCurrency(50, { inputInCents: true, decimals: 2 })).toBe('$0.50')
    })

    it('handles fractional cents with decimals', () => {
      expect(formatCurrency(12345, { inputInCents: true, decimals: 2 })).toBe('$123.45')
    })
  })

  describe('GST exclusion', () => {
    it('excludes GST (divides by 1.1)', () => {
      // $110 with GST removed = $100
      const result = formatCurrency(110, { excludeGST: true, decimals: 2 })
      expect(result).toBe('$100.00')
    })

    it('excludes GST with cents input', () => {
      // 11000 cents = $110, GST excluded = $100
      const result = formatCurrency(11000, { inputInCents: true, excludeGST: true, decimals: 2 })
      expect(result).toBe('$100.00')
    })

    it('handles non-round GST exclusion', () => {
      // $100 with GST removed = $90.91 (rounded)
      const result = formatCurrency(100, { excludeGST: true, decimals: 2 })
      expect(result).toBe('$90.91')
    })
  })

  describe('decimal formatting', () => {
    it('shows no decimals by default (rounds to nearest)', () => {
      // Note: With 0 decimals, 100.50 rounds to 101 (banker's rounding)
      expect(formatCurrency(100.50)).toBe('$101')
      expect(formatCurrency(100.49)).toBe('$100')
    })

    it('shows 2 decimals when specified', () => {
      expect(formatCurrency(100.50, { decimals: 2 })).toBe('$100.50')
    })

    it('pads with zeros when decimals specified', () => {
      expect(formatCurrency(100, { decimals: 2 })).toBe('$100.00')
    })
  })

  describe('AUD currency', () => {
    it('formats AUD with correct symbol', () => {
      const result = formatCurrency(100, { currency: 'AUD' })
      // Note: In some environments, AUD shows as "$" not "A$"
      expect(result).toMatch(/\$100/)
    })

    it('formats AUD with decimals', () => {
      const result = formatCurrency(99.99, { currency: 'AUD', decimals: 2 })
      expect(result).toMatch(/\$99\.99/)
    })
  })

  describe('edge cases', () => {
    it('handles negative amounts', () => {
      expect(formatCurrency(-100)).toBe('-$100')
    })

    it('handles very large amounts', () => {
      expect(formatCurrency(999999999)).toBe('$999,999,999')
    })

    it('handles very small positive amounts', () => {
      expect(formatCurrency(0.01, { decimals: 2 })).toBe('$0.01')
    })
  })
})

describe('formatPercent', () => {
  describe('basic formatting', () => {
    it('formats positive percentage with sign', () => {
      expect(formatPercent(5.5)).toBe('+5.5%')
    })

    it('formats negative percentage', () => {
      expect(formatPercent(-3.2)).toBe('-3.2%')
    })

    it('formats zero percentage', () => {
      expect(formatPercent(0)).toBe('0.0%')
    })
  })

  describe('null/undefined handling', () => {
    it('returns em dash for null', () => {
      expect(formatPercent(null)).toBe('—')
    })

    it('returns em dash for undefined', () => {
      expect(formatPercent(undefined)).toBe('—')
    })
  })

  describe('decimal options', () => {
    it('uses 1 decimal by default', () => {
      expect(formatPercent(5)).toBe('+5.0%')
    })

    it('respects custom decimal places', () => {
      expect(formatPercent(5.567, { decimals: 2 })).toBe('+5.57%')
    })

    it('formats zero with custom decimals', () => {
      expect(formatPercent(0, { decimals: 2 })).toBe('0.00%')
    })
  })

  describe('sign options', () => {
    it('shows sign by default', () => {
      expect(formatPercent(10)).toBe('+10.0%')
    })

    it('hides sign when showSign is false', () => {
      expect(formatPercent(10, { showSign: false })).toBe('10.0%')
    })

    it('negative sign always shows', () => {
      expect(formatPercent(-10, { showSign: false })).toBe('-10.0%')
    })
  })

  describe('edge cases', () => {
    it('handles very large percentages', () => {
      expect(formatPercent(1000)).toBe('+1000.0%')
    })

    it('handles very small percentages', () => {
      expect(formatPercent(0.1, { decimals: 2 })).toBe('+0.10%')
    })
  })
})

describe('getPercentColor', () => {
  it('returns green for positive values', () => {
    expect(getPercentColor(5)).toBe('text-green-600')
  })

  it('returns red for negative values', () => {
    expect(getPercentColor(-5)).toBe('text-red-600')
  })

  it('returns muted for zero', () => {
    expect(getPercentColor(0)).toBe('text-muted-foreground')
  })

  it('returns muted for null', () => {
    expect(getPercentColor(null)).toBe('text-muted-foreground')
  })

  it('returns muted for undefined', () => {
    expect(getPercentColor(undefined)).toBe('text-muted-foreground')
  })
})

describe('calculatePercentChange', () => {
  it('calculates positive change', () => {
    // 120 from 100 = +20%
    expect(calculatePercentChange(120, 100)).toBe(20)
  })

  it('calculates negative change', () => {
    // 80 from 100 = -20%
    expect(calculatePercentChange(80, 100)).toBe(-20)
  })

  it('calculates no change', () => {
    expect(calculatePercentChange(100, 100)).toBe(0)
  })

  it('handles zero previous with positive current', () => {
    expect(calculatePercentChange(100, 0)).toBe(100)
  })

  it('handles zero previous with zero current', () => {
    expect(calculatePercentChange(0, 0)).toBe(0)
  })

  it('handles doubling', () => {
    // 200 from 100 = +100%
    expect(calculatePercentChange(200, 100)).toBe(100)
  })

  it('handles halving', () => {
    // 50 from 100 = -50%
    expect(calculatePercentChange(50, 100)).toBe(-50)
  })

  it('handles fractional changes', () => {
    // 105 from 100 = +5%
    expect(calculatePercentChange(105, 100)).toBe(5)
  })
})

describe('centsToDollars', () => {
  it('converts cents to dollars', () => {
    expect(centsToDollars(10000)).toBe(100)
  })

  it('handles zero', () => {
    expect(centsToDollars(0)).toBe(0)
  })

  it('handles fractional cents', () => {
    expect(centsToDollars(1050)).toBe(10.5)
  })

  it('handles single cent', () => {
    expect(centsToDollars(1)).toBe(0.01)
  })

  it('handles large amounts', () => {
    expect(centsToDollars(123456789)).toBe(1234567.89)
  })
})

describe('dollarsToCents', () => {
  it('converts dollars to cents', () => {
    expect(dollarsToCents(100)).toBe(10000)
  })

  it('handles zero', () => {
    expect(dollarsToCents(0)).toBe(0)
  })

  it('rounds fractional cents', () => {
    // $10.555 should round to 1056 cents
    expect(dollarsToCents(10.555)).toBe(1056)
  })

  it('handles small amounts', () => {
    expect(dollarsToCents(0.01)).toBe(1)
  })

  it('handles large amounts', () => {
    expect(dollarsToCents(1234567.89)).toBe(123456789)
  })

  it('rounds down for .004', () => {
    expect(dollarsToCents(10.004)).toBe(1000)
  })

  it('rounds up for .005', () => {
    expect(dollarsToCents(10.005)).toBe(1001)
  })
})
