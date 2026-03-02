import { describe, it, expect } from 'vitest'
import {
  getFirstSaturdayOfYear,
  getSaturdayNumber,
  getNthSaturday,
  getSaturdaysInYear,
  getSameSaturdayLastYear,
  findSaturdayInRange,
} from '../saturday-utils'

// Helper to create a date at midnight
function date(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

describe('getFirstSaturdayOfYear', () => {
  it('returns Jan 3 for 2026 (Jan 1 is Thursday)', () => {
    const firstSat = getFirstSaturdayOfYear(2026)
    expect(firstSat.getFullYear()).toBe(2026)
    expect(firstSat.getMonth()).toBe(0) // January
    expect(firstSat.getDate()).toBe(3)
    expect(firstSat.getDay()).toBe(6) // Saturday
  })

  it('returns Jan 4 for 2025 (Jan 1 is Wednesday)', () => {
    const firstSat = getFirstSaturdayOfYear(2025)
    expect(firstSat.getFullYear()).toBe(2025)
    expect(firstSat.getMonth()).toBe(0)
    expect(firstSat.getDate()).toBe(4)
    expect(firstSat.getDay()).toBe(6)
  })

  it('returns Jan 1 for 2022 (Jan 1 is Saturday)', () => {
    const firstSat = getFirstSaturdayOfYear(2022)
    expect(firstSat.getFullYear()).toBe(2022)
    expect(firstSat.getMonth()).toBe(0)
    expect(firstSat.getDate()).toBe(1)
    expect(firstSat.getDay()).toBe(6)
  })

  it('returns Jan 7 for 2023 (Jan 1 is Sunday)', () => {
    const firstSat = getFirstSaturdayOfYear(2023)
    expect(firstSat.getFullYear()).toBe(2023)
    expect(firstSat.getMonth()).toBe(0)
    expect(firstSat.getDate()).toBe(7)
    expect(firstSat.getDay()).toBe(6)
  })
})

describe('getSaturdayNumber', () => {
  it('returns 1 for first Saturday of 2026', () => {
    const sat = date(2026, 1, 3)
    expect(getSaturdayNumber(sat)).toBe(1)
  })

  it('returns 2 for second Saturday of 2026', () => {
    const sat = date(2026, 1, 10)
    expect(getSaturdayNumber(sat)).toBe(2)
  })

  it('returns 52 for last Saturday of 2026 (Dec 26)', () => {
    const sat = date(2026, 12, 26)
    expect(getSaturdayNumber(sat)).toBe(52)
  })

  it('returns 0 for non-Saturday', () => {
    const monday = date(2026, 1, 5)
    expect(getSaturdayNumber(monday)).toBe(0)
  })
})

describe('getNthSaturday', () => {
  it('returns correct date for 1st Saturday of 2026', () => {
    const sat = getNthSaturday(2026, 1)
    expect(sat).not.toBeNull()
    expect(sat!.getFullYear()).toBe(2026)
    expect(sat!.getMonth()).toBe(0)
    expect(sat!.getDate()).toBe(3)
  })

  it('returns correct date for 7th Saturday of 2025', () => {
    const sat = getNthSaturday(2025, 7)
    expect(sat).not.toBeNull()
    // First Saturday of 2025 is Jan 4, 7th = Feb 15
    expect(sat!.getFullYear()).toBe(2025)
    expect(sat!.getMonth()).toBe(1) // February
    expect(sat!.getDate()).toBe(15)
    expect(sat!.getDay()).toBe(6)
  })

  it('returns null for n < 1', () => {
    expect(getNthSaturday(2026, 0)).toBeNull()
    expect(getNthSaturday(2026, -1)).toBeNull()
  })

  it('returns null for n > Saturdays in year', () => {
    // 2026 has 52 Saturdays
    expect(getNthSaturday(2026, 53)).toBeNull()
    expect(getNthSaturday(2026, 54)).toBeNull()
  })

  it('handles 53-Saturday year', () => {
    // 2022 starts on Saturday and has 53 Saturdays
    const sat53 = getNthSaturday(2022, 53)
    expect(sat53).not.toBeNull()
    expect(sat53!.getFullYear()).toBe(2022)
    expect(sat53!.getMonth()).toBe(11) // December
    expect(sat53!.getDate()).toBe(31)
  })
})

describe('getSaturdaysInYear', () => {
  it('returns 52 for 2026', () => {
    expect(getSaturdaysInYear(2026)).toBe(52)
  })

  it('returns 52 for 2025', () => {
    expect(getSaturdaysInYear(2025)).toBe(52)
  })

  it('returns 53 for 2022 (Jan 1 is Saturday)', () => {
    expect(getSaturdaysInYear(2022)).toBe(53)
  })

  it('returns 53 for 2028 (leap year, Jan 1 is Saturday)', () => {
    expect(getSaturdaysInYear(2028)).toBe(53)
  })
})

describe('getSameSaturdayLastYear', () => {
  it('maps Saturday #7 of 2026 to Saturday #7 of 2025', () => {
    // 7th Saturday of 2026 = Feb 14, 2026
    const sat2026 = date(2026, 2, 14)
    const sat2025 = getSameSaturdayLastYear(sat2026)

    expect(sat2025).not.toBeNull()
    // 7th Saturday of 2025 = Feb 15, 2025
    expect(sat2025!.getFullYear()).toBe(2025)
    expect(sat2025!.getMonth()).toBe(1)
    expect(sat2025!.getDate()).toBe(15)
  })

  it('maps first Saturday correctly', () => {
    const sat2026 = date(2026, 1, 3)
    const sat2025 = getSameSaturdayLastYear(sat2026)

    expect(sat2025).not.toBeNull()
    expect(sat2025!.getFullYear()).toBe(2025)
    expect(sat2025!.getDate()).toBe(4)
  })

  it('falls back Saturday #53 to #52 when needed', () => {
    // 2022 has 53 Saturdays, 53rd = Dec 31, 2022
    const sat2022 = date(2022, 12, 31)
    const sat2021 = getSameSaturdayLastYear(sat2022)

    expect(sat2021).not.toBeNull()
    // 2021 has 52 Saturdays, so #53 -> #52 (Dec 25, 2021)
    expect(sat2021!.getFullYear()).toBe(2021)
    expect(sat2021!.getMonth()).toBe(11)
    expect(sat2021!.getDate()).toBe(25)
  })

  it('returns null for non-Saturday', () => {
    const monday = date(2026, 1, 5)
    expect(getSameSaturdayLastYear(monday)).toBeNull()
  })

  it('preserves day of week (always returns Saturday)', () => {
    const testDates = [date(2026, 1, 3), date(2026, 6, 20), date(2026, 12, 26)]

    for (const d of testDates) {
      const lastYear = getSameSaturdayLastYear(d)
      expect(lastYear).not.toBeNull()
      expect(lastYear!.getDay()).toBe(6)
    }
  })
})

describe('findSaturdayInRange', () => {
  it('finds Saturday in 7-day range', () => {
    // Jan 1 (Thu) to Jan 7 (Wed) 2026 - contains Jan 3 (Sat)
    const start = date(2026, 1, 1)
    const end = date(2026, 1, 7)
    const sat = findSaturdayInRange(start, end)

    expect(sat).not.toBeNull()
    expect(sat!.getDate()).toBe(3)
    expect(sat!.getDay()).toBe(6)
  })

  it('returns null when no Saturday in range', () => {
    // Jan 4 (Sun) to Jan 9 (Fri) 2026 - no Saturday
    const start = date(2026, 1, 4)
    const end = date(2026, 1, 9)
    const sat = findSaturdayInRange(start, end)

    expect(sat).toBeNull()
  })

  it('returns Saturday when range is single Saturday', () => {
    const start = date(2026, 1, 3)
    const end = date(2026, 1, 3)
    const sat = findSaturdayInRange(start, end)

    expect(sat).not.toBeNull()
    expect(sat!.getDate()).toBe(3)
  })
})

describe('round-trip consistency', () => {
  it('getNthSaturday then getSaturdayNumber returns same number', () => {
    for (let n = 1; n <= 52; n++) {
      const sat = getNthSaturday(2026, n)
      expect(sat).not.toBeNull()
      expect(getSaturdayNumber(sat!)).toBe(n)
    }
  })

  it('YoY comparison maintains same Saturday number', () => {
    for (let n = 1; n <= 52; n++) {
      const sat2026 = getNthSaturday(2026, n)
      expect(sat2026).not.toBeNull()

      const sat2025 = getSameSaturdayLastYear(sat2026!)
      expect(sat2025).not.toBeNull()

      const num2025 = getSaturdayNumber(sat2025!)
      expect(num2025).toBe(n)
    }
  })
})
