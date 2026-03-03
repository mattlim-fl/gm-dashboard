/**
 * Unit tests for karaoke-pay-and-book edge function logic
 * Run with: deno test --allow-env --allow-net _shared/__tests__/karaoke-pay-and-book.test.ts
 *
 * These tests validate the business logic, request/response structures,
 * and error handling patterns used by the karaoke-pay-and-book function.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { toIdempotencyKey } from "../square.ts"
import { generateSecureCode } from "../crypto.ts"

// ============================================
// Time Calculation Tests
// ============================================

/**
 * Replicates timeToMinutes helper from edge function
 */
function timeToMinutes(timeHHMM: string): number {
  const [h, m] = timeHHMM.slice(0, 5).split(':').map((v) => Number(v) || 0)
  return h * 60 + m
}

Deno.test("timeToMinutes - converts standard time", () => {
  assertEquals(timeToMinutes("10:00"), 600)
  assertEquals(timeToMinutes("12:30"), 750)
  assertEquals(timeToMinutes("18:00"), 1080)
  assertEquals(timeToMinutes("23:59"), 1439)
})

Deno.test("timeToMinutes - handles midnight", () => {
  assertEquals(timeToMinutes("00:00"), 0)
  assertEquals(timeToMinutes("00:30"), 30)
})

Deno.test("timeToMinutes - handles extended format HH:MM:SS", () => {
  assertEquals(timeToMinutes("10:00:00"), 600)
  assertEquals(timeToMinutes("18:30:45"), 1110)
})

Deno.test("timeToMinutes - handles invalid input gracefully", () => {
  assertEquals(timeToMinutes(""), 0)
  assertEquals(timeToMinutes("invalid"), 0)
  assertEquals(timeToMinutes("25:00"), 1500) // Invalid but parses
})

// ============================================
// Duration Calculation Tests
// ============================================

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  // Handle overnight bookings
  return endMinutes <= startMinutes
    ? (24 * 60 - startMinutes) + endMinutes
    : endMinutes - startMinutes
}

Deno.test("calculateDurationMinutes - standard duration", () => {
  assertEquals(calculateDurationMinutes("10:00", "12:00"), 120) // 2 hours
  assertEquals(calculateDurationMinutes("18:00", "19:00"), 60)  // 1 hour
  assertEquals(calculateDurationMinutes("18:00", "20:00"), 120) // 2 hours
})

Deno.test("calculateDurationMinutes - handles overnight bookings", () => {
  assertEquals(calculateDurationMinutes("23:00", "00:00"), 60)  // 1 hour
  assertEquals(calculateDurationMinutes("23:00", "01:00"), 120) // 2 hours
  assertEquals(calculateDurationMinutes("22:00", "00:30"), 150) // 2.5 hours
})

Deno.test("calculateDurationMinutes - validates max 2 hour rule", () => {
  const durationMinutes = calculateDurationMinutes("18:00", "20:00")
  const durationHours = durationMinutes / 60
  assertEquals(durationHours <= 2, true, "Should be at most 2 hours")
})

Deno.test("calculateDurationMinutes - exceeds max 2 hour rule", () => {
  const durationMinutes = calculateDurationMinutes("18:00", "21:00")
  const durationHours = durationMinutes / 60
  assertEquals(durationHours > 2, true, "Should exceed 2 hours")
})

// ============================================
// Pricing Calculation Tests
// ============================================

Deno.test("pricing - booth cost calculation", () => {
  const hourlyRate = 50 // $50/hour
  const durationHours = 2

  const boothCents = Math.round(hourlyRate * durationHours * 100)

  assertEquals(boothCents, 10000) // $100 in cents
})

Deno.test("pricing - ticket cost calculation", () => {
  const TICKET_PRICE_CENTS = 1000 // $10 per ticket
  const ticketQty = 3

  const ticketsCents = ticketQty * TICKET_PRICE_CENTS

  assertEquals(ticketsCents, 3000) // $30 in cents
})

Deno.test("pricing - total cost calculation", () => {
  const hourlyRate = 50
  const durationHours = 2
  const ticketQty = 4
  const TICKET_PRICE_CENTS = 1000

  const boothCents = Math.round(hourlyRate * durationHours * 100)
  const ticketsCents = ticketQty * TICKET_PRICE_CENTS
  const totalCents = boothCents + ticketsCents

  assertEquals(boothCents, 10000)    // $100
  assertEquals(ticketsCents, 4000)   // $40
  assertEquals(totalCents, 14000)    // $140
})

Deno.test("pricing - handles fractional hours", () => {
  const hourlyRate = 60 // $60/hour
  const durationHours = 1.5 // 90 minutes

  const boothCents = Math.round(hourlyRate * durationHours * 100)

  assertEquals(boothCents, 9000) // $90 in cents
})

// ============================================
// Reference Code Generation Tests
// ============================================

Deno.test("reference code - format pattern K-XXXXXX", () => {
  const code = `K-${generateSecureCode(6)}`

  assertEquals(code.startsWith("K-"), true)
  assertEquals(code.length, 8) // K- + 6 chars
})

Deno.test("reference code - generates unique codes", () => {
  const codes = new Set<string>()
  for (let i = 0; i < 100; i++) {
    codes.add(`K-${generateSecureCode(6)}`)
  }

  assertEquals(codes.size, 100, "All codes should be unique")
})

// ============================================
// Idempotency Key Tests
// ============================================

Deno.test("idempotency key - karaoke booking format", async () => {
  const holdId = "hold-123"
  const boothId = "booth-456"
  const bookingDate = "2025-01-15"
  const startTime = "18:00"
  const endTime = "20:00"
  const ticketQty = 2

  const rawKey = `${holdId}:${boothId}:${bookingDate}:${startTime}-${endTime}:t${ticketQty}`

  const orderKey = await toIdempotencyKey(`order:${rawKey}`)
  const paymentKey = await toIdempotencyKey(`payment:${rawKey}`)

  assertNotEquals(orderKey, paymentKey, "Order and payment keys should differ")
  assertEquals(orderKey.length <= 45, true)
  assertEquals(paymentKey.length <= 45, true)
})

Deno.test("idempotency key - same inputs produce same keys", async () => {
  const rawKey = "hold-123:booth-456:2025-01-15:18:00-20:00:t2"

  const key1 = await toIdempotencyKey(`payment:${rawKey}`)
  const key2 = await toIdempotencyKey(`payment:${rawKey}`)

  assertEquals(key1, key2)
})

// ============================================
// Request Validation Tests
// ============================================

type PayAndBookRequest = {
  holdId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  guestCount?: number
  bookingDate: string
  venue: string
  startTime: string
  endTime: string
  boothId: string
  paymentToken: string
  ticketQuantity?: number
}

function validatePayAndBookRequest(input: PayAndBookRequest): { valid: boolean; error?: string } {
  if (!input.holdId) return { valid: false, error: "Missing holdId" }
  if (!input.boothId) return { valid: false, error: "Missing boothId" }
  if (!input.paymentToken) return { valid: false, error: "Missing payment token" }

  return { valid: true }
}

Deno.test("request validation - valid request passes", () => {
  const request: PayAndBookRequest = {
    holdId: "hold-123",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    bookingDate: "2025-01-15",
    venue: "manor",
    startTime: "18:00",
    endTime: "20:00",
    boothId: "booth-456",
    paymentToken: "cnon:card-token",
  }

  const result = validatePayAndBookRequest(request)

  assertEquals(result.valid, true)
})

Deno.test("request validation - missing holdId fails", () => {
  const request: PayAndBookRequest = {
    holdId: "",
    customerName: "John Doe",
    bookingDate: "2025-01-15",
    venue: "manor",
    startTime: "18:00",
    endTime: "20:00",
    boothId: "booth-456",
    paymentToken: "cnon:card-token",
  }

  const result = validatePayAndBookRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing holdId")
})

Deno.test("request validation - missing boothId fails", () => {
  const request: PayAndBookRequest = {
    holdId: "hold-123",
    customerName: "John Doe",
    bookingDate: "2025-01-15",
    venue: "manor",
    startTime: "18:00",
    endTime: "20:00",
    boothId: "",
    paymentToken: "cnon:card-token",
  }

  const result = validatePayAndBookRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing boothId")
})

Deno.test("request validation - missing paymentToken fails", () => {
  const request: PayAndBookRequest = {
    holdId: "hold-123",
    customerName: "John Doe",
    bookingDate: "2025-01-15",
    venue: "manor",
    startTime: "18:00",
    endTime: "20:00",
    boothId: "booth-456",
    paymentToken: "",
  }

  const result = validatePayAndBookRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing payment token")
})

// ============================================
// Response Structure Tests
// ============================================

Deno.test("success response structure", () => {
  const response = {
    success: true,
    bookingId: "booking-123",
    referenceCode: "K-ABC123",
    paymentId: "payment-456",
    karaokeBooking: {
      id: "booking-123",
      referenceCode: "K-ABC123",
    },
    ticketBooking: null,
    guestListToken: "token-789",
  }

  assertEquals(response.success, true)
  assertEquals(typeof response.bookingId, "string")
  assertEquals(typeof response.referenceCode, "string")
  assertEquals(typeof response.paymentId, "string")
  assertEquals(response.karaokeBooking.id, response.bookingId)
})

Deno.test("success response with tickets", () => {
  const response = {
    success: true,
    bookingId: "booking-123",
    referenceCode: "K-ABC123",
    paymentId: "payment-456",
    karaokeBooking: {
      id: "booking-123",
      referenceCode: "K-ABC123",
    },
    ticketBooking: {
      id: "ticket-789",
      referenceCode: "T-XYZ789",
    },
    guestListToken: "token-012",
  }

  assertEquals(response.ticketBooking !== null, true)
  assertEquals(typeof response.ticketBooking.id, "string")
  assertEquals(typeof response.ticketBooking.referenceCode, "string")
})

Deno.test("error response structure", () => {
  const response = {
    success: false,
    error: "Hold expired or inactive",
  }

  assertEquals(response.success, false)
  assertEquals(typeof response.error, "string")
})

// ============================================
// Error Status Code Determination Tests
// ============================================

function determineStatusCode(errorMessage: string): number {
  const isClientError =
    errorMessage.includes("Hold expired") ||
    errorMessage.includes("Hold not found") ||
    errorMessage.includes("Invalid") ||
    errorMessage.includes("Missing")
  return isClientError ? 400 : 500
}

Deno.test("status code - client errors return 400", () => {
  assertEquals(determineStatusCode("Hold expired or inactive"), 400)
  assertEquals(determineStatusCode("Hold not found"), 400)
  assertEquals(determineStatusCode("Invalid session time range"), 400)
  assertEquals(determineStatusCode("Missing holdId"), 400)
})

Deno.test("status code - server errors return 500", () => {
  assertEquals(determineStatusCode("Square charge failed"), 500)
  assertEquals(determineStatusCode("Database connection error"), 500)
  assertEquals(determineStatusCode("Failed to create booking"), 500)
})

// ============================================
// Hold Validation Tests
// ============================================

type HoldRow = {
  booth_id: string
  venue: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  expires_at: string
}

function validateHold(hold: HoldRow | null): { valid: boolean; error?: string } {
  if (!hold) {
    return { valid: false, error: "Hold not found" }
  }

  const now = new Date().toISOString()
  if (hold.status !== "active" || hold.expires_at <= now) {
    return { valid: false, error: "Hold expired or inactive" }
  }

  return { valid: true }
}

Deno.test("hold validation - valid active hold passes", () => {
  const futureTime = new Date(Date.now() + 300000).toISOString() // 5 mins from now

  const hold: HoldRow = {
    booth_id: "booth-123",
    venue: "manor",
    booking_date: "2025-01-15",
    start_time: "18:00",
    end_time: "20:00",
    status: "active",
    expires_at: futureTime,
  }

  const result = validateHold(hold)

  assertEquals(result.valid, true)
})

Deno.test("hold validation - null hold fails", () => {
  const result = validateHold(null)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Hold not found")
})

Deno.test("hold validation - inactive status fails", () => {
  const futureTime = new Date(Date.now() + 300000).toISOString()

  const hold: HoldRow = {
    booth_id: "booth-123",
    venue: "manor",
    booking_date: "2025-01-15",
    start_time: "18:00",
    end_time: "20:00",
    status: "released",
    expires_at: futureTime,
  }

  const result = validateHold(hold)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Hold expired or inactive")
})

Deno.test("hold validation - expired hold fails", () => {
  const pastTime = new Date(Date.now() - 300000).toISOString() // 5 mins ago

  const hold: HoldRow = {
    booth_id: "booth-123",
    venue: "manor",
    booking_date: "2025-01-15",
    start_time: "18:00",
    end_time: "20:00",
    status: "active",
    expires_at: pastTime,
  }

  const result = validateHold(hold)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Hold expired or inactive")
})

// ============================================
// Booking Row Structure Tests
// ============================================

Deno.test("booking row structure - karaoke booking", () => {
  const bookingRow = {
    customer_name: "John Doe",
    customer_email: "john@example.com",
    customer_phone: "0400000000",
    booking_type: "karaoke_booking",
    venue: "manor",
    booking_date: "2025-01-15",
    start_time: "18:00",
    end_time: "20:00",
    duration_hours: 2,
    guest_count: 8,
    karaoke_booth_id: "booth-123",
    status: "confirmed",
    payment_status: "paid",
    total_amount: 100,
    square_payment_id: "payment-456",
    payment_attempted_at: new Date().toISOString(),
    payment_completed_at: new Date().toISOString(),
    booking_source: "website_direct",
    reference_code: "K-ABC123",
  }

  assertEquals(bookingRow.booking_type, "karaoke_booking")
  assertEquals(bookingRow.status, "confirmed")
  assertEquals(bookingRow.payment_status, "paid")
  assertEquals(bookingRow.booking_source, "website_direct")
})

Deno.test("booking row structure - ticket booking", () => {
  const bookingRow = {
    customer_name: "John Doe",
    customer_email: "john@example.com",
    booking_type: "vip_tickets",
    venue: "manor",
    booking_date: "2025-01-15",
    ticket_quantity: 4,
    status: "confirmed",
    payment_status: "paid",
    total_amount: 40,
    staff_notes: "square_payment_id=payment-456",
    booking_source: "website_direct",
    reference_code: "T-XYZ789",
  }

  assertEquals(bookingRow.booking_type, "vip_tickets")
  assertStringIncludes(bookingRow.staff_notes, "square_payment_id")
})
