/**
 * Saturday Numbering Utilities
 *
 * For Saturday-only trading businesses, comparing "Saturday #15 of 2026" to
 * "Saturday #15 of 2025" is more meaningful than calendar-based YoY comparisons.
 */

/**
 * Get the first Saturday of a given year
 */
export function getFirstSaturdayOfYear(year: number): Date {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay()
  // Saturday is day 6. Calculate days until next Saturday
  const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7
  const firstSaturday = new Date(jan1)
  firstSaturday.setDate(jan1.getDate() + daysUntilSaturday)
  return firstSaturday
}

/**
 * Get the Saturday number within a year (1-indexed)
 * e.g., first Saturday of 2026 = 1, second = 2, etc.
 *
 * @param date - The date to check (should be a Saturday)
 * @returns The Saturday number (1-53), or 0 if not a Saturday
 */
export function getSaturdayNumber(date: Date): number {
  // Validate it's a Saturday
  if (date.getDay() !== 6) {
    return 0
  }

  const year = date.getFullYear()
  const firstSaturday = getFirstSaturdayOfYear(year)

  // Calculate the difference in days and convert to weeks
  const diffTime = date.getTime() - firstSaturday.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  const saturdayNumber = Math.floor(diffDays / 7) + 1

  return saturdayNumber
}

/**
 * Get the Nth Saturday of a given year
 * e.g., getNthSaturday(2025, 7) returns the 7th Saturday of 2025
 *
 * @param year - The year
 * @param n - The Saturday number (1-indexed)
 * @returns The date of the Nth Saturday, or null if the year doesn't have that many Saturdays
 */
export function getNthSaturday(year: number, n: number): Date | null {
  if (n < 1) return null

  const firstSaturday = getFirstSaturdayOfYear(year)
  const nthSaturday = new Date(firstSaturday)
  nthSaturday.setDate(firstSaturday.getDate() + (n - 1) * 7)

  // Check if we're still in the same year
  if (nthSaturday.getFullYear() !== year) {
    return null
  }

  return nthSaturday
}

/**
 * Get the total number of Saturdays in a year (52 or 53)
 */
export function getSaturdaysInYear(year: number): number {
  const firstSaturday = getFirstSaturdayOfYear(year)
  const lastDayOfYear = new Date(year, 11, 31)

  // Calculate days from first Saturday to end of year
  const diffTime = lastDayOfYear.getTime() - firstSaturday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Number of Saturdays = number of full weeks + 1 (for the first Saturday)
  return Math.floor(diffDays / 7) + 1
}

/**
 * Get the corresponding Saturday from the previous year
 * (same Saturday number, different year)
 *
 * If requesting Saturday #53 in a 52-Saturday year, returns the last Saturday of that year.
 *
 * @param date - The current Saturday to find the YoY equivalent for
 * @returns The corresponding Saturday from last year, or null if input is not a Saturday
 */
export function getSameSaturdayLastYear(date: Date): Date | null {
  // Validate it's a Saturday
  if (date.getDay() !== 6) {
    return null
  }

  const saturdayNumber = getSaturdayNumber(date)
  if (saturdayNumber === 0) return null

  const lastYear = date.getFullYear() - 1
  const saturdaysInLastYear = getSaturdaysInYear(lastYear)

  // If the current Saturday number exceeds last year's count, use the last Saturday
  const targetSaturdayNumber = Math.min(saturdayNumber, saturdaysInLastYear)

  return getNthSaturday(lastYear, targetSaturdayNumber)
}

/**
 * Find the Saturday within a date range
 * Useful for finding the Saturday in a 7-day reporting period
 *
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @returns The Saturday within the range, or null if none exists
 */
export function findSaturdayInRange(startDate: Date, endDate: Date): Date | null {
  const current = new Date(startDate)
  while (current <= endDate) {
    if (current.getDay() === 6) {
      return new Date(current)
    }
    current.setDate(current.getDate() + 1)
  }
  return null
}
