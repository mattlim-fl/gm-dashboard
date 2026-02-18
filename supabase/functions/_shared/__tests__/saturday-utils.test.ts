import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts"

import {
  getFirstSaturdayOfYear,
  getSaturdayNumber,
  getNthSaturday,
  getSaturdaysInYear,
  getSameSaturdayLastYear,
  findSaturdayInRange,
} from "../saturday-utils.ts"

// Helper to create a date at midnight
function date(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

// ==========================================
// getFirstSaturdayOfYear tests
// ==========================================

Deno.test("getFirstSaturdayOfYear - 2026 (Jan 1 is Thursday)", () => {
  const firstSat = getFirstSaturdayOfYear(2026)
  assertEquals(firstSat.getFullYear(), 2026)
  assertEquals(firstSat.getMonth(), 0) // January
  assertEquals(firstSat.getDate(), 3) // Jan 3, 2026 is Saturday
  assertEquals(firstSat.getDay(), 6) // Saturday
})

Deno.test("getFirstSaturdayOfYear - 2025 (Jan 1 is Wednesday)", () => {
  const firstSat = getFirstSaturdayOfYear(2025)
  assertEquals(firstSat.getFullYear(), 2025)
  assertEquals(firstSat.getMonth(), 0) // January
  assertEquals(firstSat.getDate(), 4) // Jan 4, 2025 is Saturday
  assertEquals(firstSat.getDay(), 6)
})

Deno.test("getFirstSaturdayOfYear - 2022 (Jan 1 is Saturday)", () => {
  const firstSat = getFirstSaturdayOfYear(2022)
  assertEquals(firstSat.getFullYear(), 2022)
  assertEquals(firstSat.getMonth(), 0) // January
  assertEquals(firstSat.getDate(), 1) // Jan 1, 2022 is Saturday
  assertEquals(firstSat.getDay(), 6)
})

Deno.test("getFirstSaturdayOfYear - 2023 (Jan 1 is Sunday)", () => {
  const firstSat = getFirstSaturdayOfYear(2023)
  assertEquals(firstSat.getFullYear(), 2023)
  assertEquals(firstSat.getMonth(), 0) // January
  assertEquals(firstSat.getDate(), 7) // Jan 7, 2023 is first Saturday
  assertEquals(firstSat.getDay(), 6)
})

// ==========================================
// getSaturdayNumber tests
// ==========================================

Deno.test("getSaturdayNumber - first Saturday of 2026", () => {
  const sat = date(2026, 1, 3) // Jan 3, 2026
  assertEquals(getSaturdayNumber(sat), 1)
})

Deno.test("getSaturdayNumber - second Saturday of 2026", () => {
  const sat = date(2026, 1, 10) // Jan 10, 2026
  assertEquals(getSaturdayNumber(sat), 2)
})

Deno.test("getSaturdayNumber - mid-year Saturday (July 11, 2026)", () => {
  // July 11, 2026 is a Saturday
  const sat = date(2026, 7, 11)
  // First Saturday is Jan 3, 2026
  // Days between: Jan 3 to Jul 11 = 189 days
  // 189 / 7 = 27 weeks, so Saturday #28
  assertEquals(getSaturdayNumber(sat), 28)
})

Deno.test("getSaturdayNumber - last Saturday of 2026 (Dec 26)", () => {
  // Dec 26, 2026 is the last Saturday of 2026
  const sat = date(2026, 12, 26)
  assertEquals(getSaturdayNumber(sat), 52)
})

Deno.test("getSaturdayNumber - returns 0 for non-Saturday", () => {
  const monday = date(2026, 1, 5)
  assertEquals(getSaturdayNumber(monday), 0)
})

// ==========================================
// getNthSaturday tests
// ==========================================

Deno.test("getNthSaturday - 1st Saturday of 2026", () => {
  const sat = getNthSaturday(2026, 1)
  assertNotEquals(sat, null)
  assertEquals(sat!.getFullYear(), 2026)
  assertEquals(sat!.getMonth(), 0) // January
  assertEquals(sat!.getDate(), 3)
})

Deno.test("getNthSaturday - 7th Saturday of 2025", () => {
  const sat = getNthSaturday(2025, 7)
  assertNotEquals(sat, null)
  // First Saturday of 2025 is Jan 4
  // 7th Saturday = Jan 4 + 6 weeks = Feb 15, 2025
  assertEquals(sat!.getFullYear(), 2025)
  assertEquals(sat!.getMonth(), 1) // February
  assertEquals(sat!.getDate(), 15)
  assertEquals(sat!.getDay(), 6)
})

Deno.test("getNthSaturday - returns null for n < 1", () => {
  assertEquals(getNthSaturday(2026, 0), null)
  assertEquals(getNthSaturday(2026, -1), null)
})

Deno.test("getNthSaturday - returns null for n > Saturdays in year", () => {
  // 2026 has 52 Saturdays (Jan 3 to Dec 26)
  assertEquals(getNthSaturday(2026, 53), null)
  assertEquals(getNthSaturday(2026, 54), null)
})

Deno.test("getNthSaturday - handles 53-Saturday year", () => {
  // 2022 starts on Saturday (Jan 1) and has 53 Saturdays
  const sat53 = getNthSaturday(2022, 53)
  assertNotEquals(sat53, null)
  assertEquals(sat53!.getFullYear(), 2022)
  assertEquals(sat53!.getMonth(), 11) // December
  assertEquals(sat53!.getDate(), 31) // Dec 31, 2022 is Saturday
})

// ==========================================
// getSaturdaysInYear tests
// ==========================================

Deno.test("getSaturdaysInYear - 2026 has 52 Saturdays", () => {
  assertEquals(getSaturdaysInYear(2026), 52)
})

Deno.test("getSaturdaysInYear - 2025 has 52 Saturdays", () => {
  assertEquals(getSaturdaysInYear(2025), 52)
})

Deno.test("getSaturdaysInYear - 2022 has 53 Saturdays (Jan 1 is Saturday)", () => {
  assertEquals(getSaturdaysInYear(2022), 53)
})

Deno.test("getSaturdaysInYear - 2028 has 53 Saturdays (Dec 30 is Saturday)", () => {
  // 2028 is a leap year, Jan 1 is Saturday
  assertEquals(getSaturdaysInYear(2028), 53)
})

// ==========================================
// getSameSaturdayLastYear tests
// ==========================================

Deno.test("getSameSaturdayLastYear - Saturday #7 of 2026 to 2025", () => {
  // 7th Saturday of 2026 = Feb 14, 2026
  const sat2026 = date(2026, 2, 14)
  const sat2025 = getSameSaturdayLastYear(sat2026)

  assertNotEquals(sat2025, null)
  // 7th Saturday of 2025 = Feb 15, 2025
  assertEquals(sat2025!.getFullYear(), 2025)
  assertEquals(sat2025!.getMonth(), 1) // February
  assertEquals(sat2025!.getDate(), 15)
})

Deno.test("getSameSaturdayLastYear - first Saturday of year", () => {
  // First Saturday of 2026 = Jan 3, 2026
  const sat2026 = date(2026, 1, 3)
  const sat2025 = getSameSaturdayLastYear(sat2026)

  assertNotEquals(sat2025, null)
  // First Saturday of 2025 = Jan 4, 2025
  assertEquals(sat2025!.getFullYear(), 2025)
  assertEquals(sat2025!.getDate(), 4)
})

Deno.test("getSameSaturdayLastYear - last Saturday of 52-Saturday year", () => {
  // Last Saturday of 2026 (Saturday #52) = Dec 26, 2026
  const sat2026 = date(2026, 12, 26)
  const sat2025 = getSameSaturdayLastYear(sat2026)

  assertNotEquals(sat2025, null)
  // Saturday #52 of 2025 = Dec 27, 2025
  assertEquals(sat2025!.getFullYear(), 2025)
  assertEquals(sat2025!.getMonth(), 11) // December
  assertEquals(sat2025!.getDate(), 27)
})

Deno.test("getSameSaturdayLastYear - Saturday #53 falls back to #52 if needed", () => {
  // 2022 has 53 Saturdays (Jan 1 is Saturday), 53rd = Dec 31, 2022
  const sat2022 = date(2022, 12, 31)
  const sat2021 = getSameSaturdayLastYear(sat2022)

  assertNotEquals(sat2021, null)
  // 2021 has 52 Saturdays, so #53 -> #52 (Dec 25, 2021)
  assertEquals(sat2021!.getFullYear(), 2021)
  assertEquals(sat2021!.getMonth(), 11) // December
  assertEquals(sat2021!.getDate(), 25)
})

Deno.test("getSameSaturdayLastYear - returns null for non-Saturday", () => {
  const monday = date(2026, 1, 5)
  assertEquals(getSameSaturdayLastYear(monday), null)
})

Deno.test("getSameSaturdayLastYear - preserves day of week", () => {
  // All results should be Saturdays
  const testDates = [
    date(2026, 1, 3),
    date(2026, 6, 20),
    date(2026, 12, 26),
  ]

  for (const d of testDates) {
    const lastYear = getSameSaturdayLastYear(d)
    assertNotEquals(lastYear, null)
    assertEquals(lastYear!.getDay(), 6, `${d.toISOString()} -> ${lastYear!.toISOString()} should be Saturday`)
  }
})

// ==========================================
// findSaturdayInRange tests
// ==========================================

Deno.test("findSaturdayInRange - finds Saturday in 7-day range", () => {
  // Jan 1 (Thu) to Jan 7 (Wed) 2026 - contains Jan 3 (Sat)
  const start = date(2026, 1, 1)
  const end = date(2026, 1, 7)
  const sat = findSaturdayInRange(start, end)

  assertNotEquals(sat, null)
  assertEquals(sat!.getDate(), 3)
  assertEquals(sat!.getDay(), 6)
})

Deno.test("findSaturdayInRange - returns null when no Saturday in range", () => {
  // Jan 4 (Sun) to Jan 9 (Fri) 2026 - no Saturday
  const start = date(2026, 1, 4)
  const end = date(2026, 1, 9)
  const sat = findSaturdayInRange(start, end)

  assertEquals(sat, null)
})

Deno.test("findSaturdayInRange - returns Saturday when range is single Saturday", () => {
  const start = date(2026, 1, 3)
  const end = date(2026, 1, 3)
  const sat = findSaturdayInRange(start, end)

  assertNotEquals(sat, null)
  assertEquals(sat!.getDate(), 3)
})

// ==========================================
// Integration/Round-trip tests
// ==========================================

Deno.test("Round-trip: getNthSaturday then getSaturdayNumber", () => {
  for (let n = 1; n <= 52; n++) {
    const sat = getNthSaturday(2026, n)
    assertNotEquals(sat, null)
    assertEquals(getSaturdayNumber(sat!), n, `Saturday #${n} should round-trip`)
  }
})

Deno.test("YoY comparison maintains same Saturday number", () => {
  // Verify that getSameSaturdayLastYear returns the same Saturday number
  for (let n = 1; n <= 52; n++) {
    const sat2026 = getNthSaturday(2026, n)
    assertNotEquals(sat2026, null)

    const sat2025 = getSameSaturdayLastYear(sat2026!)
    assertNotEquals(sat2025, null)

    const num2025 = getSaturdayNumber(sat2025!)
    assertEquals(num2025, n, `Saturday #${n} of 2026 should map to Saturday #${n} of 2025`)
  }
})
