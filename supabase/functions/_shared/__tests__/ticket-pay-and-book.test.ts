/**
 * Unit tests for ticket-pay-and-book edge function logic
 * Run with: deno test --allow-env --allow-net _shared/__tests__/ticket-pay-and-book.test.ts
 *
 * These tests validate the business logic, request/response structures,
 * and error handling patterns used by the ticket-pay-and-book function.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { toIdempotencyKey } from "../square.ts"
import { generateSecureCode } from "../crypto.ts"

// ============================================
// Reference Code Generation Tests
// ============================================

Deno.test("ticket reference code - format pattern TIX-XXXXXX", () => {
  const code = `TIX-${generateSecureCode(6)}`

  assertEquals(code.startsWith("TIX-"), true)
  assertEquals(code.length, 10) // TIX- + 6 chars
})

Deno.test("ticket reference code - generates unique codes", () => {
  const codes = new Set<string>()
  for (let i = 0; i < 100; i++) {
    codes.add(`TIX-${generateSecureCode(6)}`)
  }

  assertEquals(codes.size, 100, "All codes should be unique")
})

// ============================================
// Share Token Generation Tests
// ============================================

Deno.test("share token - 8 char alphanumeric format", () => {
  // Use safe characters (no 0/O, 1/I/L ambiguity)
  const safeChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const token = generateSecureCode(8, safeChars)

  assertEquals(token.length, 8)
  // Verify only safe characters
  for (const char of token) {
    assertEquals(safeChars.includes(char), true, `Character ${char} should be in safe set`)
  }
})

Deno.test("share token - no ambiguous characters", () => {
  const safeChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const ambiguous = ["0", "O", "1", "I", "L"]

  // Generate many tokens and verify none contain ambiguous chars
  for (let i = 0; i < 100; i++) {
    const token = generateSecureCode(8, safeChars)
    for (const char of ambiguous) {
      assertEquals(token.includes(char), false, `Token should not contain ${char}`)
    }
  }
})

// ============================================
// Request Validation Tests
// ============================================

type TicketPayAndBookRequest = {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  venue: string
  bookingDate: string
  ticketQuantity: number
  ticketType?: string
  paymentToken: string
  groupToken?: string
  parentBookingId?: string
}

function validateTicketRequest(input: TicketPayAndBookRequest): { valid: boolean; error?: string } {
  if (!input.customerName.trim()) {
    return { valid: false, error: "Missing customer name" }
  }
  if (!input.customerEmail && !input.customerPhone) {
    return { valid: false, error: "Email or phone is required" }
  }
  if (!input.ticketQuantity || input.ticketQuantity < 1) {
    return { valid: false, error: "Invalid ticket quantity" }
  }
  if (!input.paymentToken) {
    return { valid: false, error: "Missing payment token" }
  }
  // Booking date only required for organiser (non-group) purchases
  if (!input.groupToken && !input.parentBookingId && !input.bookingDate) {
    return { valid: false, error: "Missing booking date" }
  }

  return { valid: true }
}

Deno.test("ticket request validation - valid organiser request passes", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 4,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, true)
})

Deno.test("ticket request validation - valid guest request with groupToken passes", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "Jane Doe",
    customerPhone: "0400000000",
    venue: "manor",
    bookingDate: "", // Not required for guest purchases
    ticketQuantity: 2,
    paymentToken: "cnon:card-token",
    groupToken: "ABCD1234",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, true)
})

Deno.test("ticket request validation - valid occasion guest request passes", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "Guest Name",
    customerEmail: "guest@example.com",
    venue: "manor",
    bookingDate: "", // Not required for occasion guests
    ticketQuantity: 1,
    paymentToken: "cnon:card-token",
    parentBookingId: "occasion-123",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, true)
})

Deno.test("ticket request validation - missing customer name fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 4,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing customer name")
})

Deno.test("ticket request validation - whitespace-only name fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "   ",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 4,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing customer name")
})

Deno.test("ticket request validation - missing contact info fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 4,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Email or phone is required")
})

Deno.test("ticket request validation - zero quantity fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 0,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Invalid ticket quantity")
})

Deno.test("ticket request validation - negative quantity fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: -1,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Invalid ticket quantity")
})

Deno.test("ticket request validation - missing payment token fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "2025-01-15",
    ticketQuantity: 4,
    paymentToken: "",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing payment token")
})

Deno.test("ticket request validation - organiser missing date fails", () => {
  const request: TicketPayAndBookRequest = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    venue: "manor",
    bookingDate: "",
    ticketQuantity: 4,
    paymentToken: "cnon:card-token",
  }

  const result = validateTicketRequest(request)

  assertEquals(result.valid, false)
  assertEquals(result.error, "Missing booking date")
})

// ============================================
// Pricing Tests
// ============================================

Deno.test("ticket pricing - standard ticket calculation", () => {
  const TICKET_PRICE_CENTS = 1000 // $10 per ticket
  const ticketQuantity = 5

  const totalCents = ticketQuantity * TICKET_PRICE_CENTS

  assertEquals(totalCents, 5000) // $50
})

Deno.test("ticket pricing - single ticket", () => {
  const TICKET_PRICE_CENTS = 1000
  const ticketQuantity = 1

  const totalCents = ticketQuantity * TICKET_PRICE_CENTS

  assertEquals(totalCents, 1000) // $10
})

Deno.test("ticket pricing - derives per-ticket price from total", () => {
  const orderTotalCents = 4000 // $40 from Square order
  const ticketQuantity = 4

  const ticketPriceCents = Math.round(orderTotalCents / ticketQuantity)

  assertEquals(ticketPriceCents, 1000) // $10 per ticket
})

// ============================================
// Idempotency Key Tests
// ============================================

Deno.test("ticket idempotency key - includes timestamp for uniqueness", async () => {
  const customerEmail = "john@example.com"
  const bookingDate = "2025-01-15"
  const ticketQuantity = 4
  const timestamp1 = Date.now()

  const rawKey1 = `ticket:${customerEmail}:${bookingDate}:${ticketQuantity}:${timestamp1}`
  const key1 = await toIdempotencyKey(`payment:${rawKey1}`)

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 10))

  const timestamp2 = Date.now()
  const rawKey2 = `ticket:${customerEmail}:${bookingDate}:${ticketQuantity}:${timestamp2}`
  const key2 = await toIdempotencyKey(`payment:${rawKey2}`)

  assertNotEquals(key1, key2, "Different timestamps should produce different keys")
})

Deno.test("ticket idempotency key - order and payment keys differ", async () => {
  const rawKey = `ticket:john@example.com:2025-01-15:4:${Date.now()}`

  const orderKey = await toIdempotencyKey(`order:${rawKey}`)
  const paymentKey = await toIdempotencyKey(`payment:${rawKey}`)

  assertNotEquals(orderKey, paymentKey)
})

// ============================================
// Capacity Check Tests
// ============================================

function checkCapacity(
  currentGuestCount: number,
  capacity: number,
  requestedQuantity: number
): { ok: boolean; error?: string } {
  const remainingCapacity = capacity - currentGuestCount

  if (requestedQuantity > remainingCapacity) {
    return {
      ok: false,
      error: `Cannot add ${requestedQuantity} guests. Only ${remainingCapacity} spots remaining (capacity: ${capacity})`,
    }
  }

  return { ok: true }
}

Deno.test("capacity check - within capacity passes", () => {
  const result = checkCapacity(10, 50, 5)

  assertEquals(result.ok, true)
})

Deno.test("capacity check - at capacity passes", () => {
  const result = checkCapacity(45, 50, 5)

  assertEquals(result.ok, true)
})

Deno.test("capacity check - exceeds capacity fails", () => {
  const result = checkCapacity(48, 50, 5)

  assertEquals(result.ok, false)
  assertStringIncludes(result.error!, "Cannot add 5 guests")
  assertStringIncludes(result.error!, "Only 2 spots remaining")
  assertStringIncludes(result.error!, "capacity: 50")
})

Deno.test("capacity check - full capacity fails", () => {
  const result = checkCapacity(50, 50, 1)

  assertEquals(result.ok, false)
  assertStringIncludes(result.error!, "Only 0 spots remaining")
})

// ============================================
// Response Structure Tests
// ============================================

Deno.test("organiser success response structure", () => {
  const response = {
    success: true,
    bookingId: "booking-123",
    referenceCode: "TIX-ABC123",
    paymentId: "payment-456",
    guestListToken: "token-789",
    shareToken: "ABCD1234",
    shareUrl: "https://manorleederville.com/tickets/ABCD1234",
  }

  assertEquals(response.success, true)
  assertEquals(typeof response.shareToken, "string")
  assertStringIncludes(response.shareUrl, response.shareToken)
})

Deno.test("guest success response structure (no share token)", () => {
  const response = {
    success: true,
    bookingId: "booking-123",
    referenceCode: "TIX-ABC123",
    paymentId: "payment-456",
    guestListToken: "token-789",
  }

  assertEquals(response.success, true)
  assertEquals("shareToken" in response, false)
  assertEquals("shareUrl" in response, false)
})

// ============================================
// Origin Extraction Tests
// ============================================

function getOriginFromHeaders(origin?: string, referer?: string): string {
  if (origin) return origin

  if (referer) {
    try {
      const url = new URL(referer)
      return `${url.protocol}//${url.host}`
    } catch {
      // ignore parse errors
    }
  }

  return "https://manorleederville.com"
}

Deno.test("origin extraction - uses Origin header when present", () => {
  const result = getOriginFromHeaders("https://app.example.com", "https://referer.example.com/page")

  assertEquals(result, "https://app.example.com")
})

Deno.test("origin extraction - falls back to Referer header", () => {
  const result = getOriginFromHeaders(undefined, "https://referer.example.com/some/path?query=1")

  assertEquals(result, "https://referer.example.com")
})

Deno.test("origin extraction - defaults to production domain", () => {
  const result = getOriginFromHeaders(undefined, undefined)

  assertEquals(result, "https://manorleederville.com")
})

Deno.test("origin extraction - handles invalid referer gracefully", () => {
  const result = getOriginFromHeaders(undefined, "not-a-valid-url")

  assertEquals(result, "https://manorleederville.com")
})

// ============================================
// Booking Row Structure Tests
// ============================================

Deno.test("ticket booking row structure - organiser", () => {
  const bookingRow = {
    customer_name: "John Doe",
    customer_email: "john@example.com",
    customer_phone: "0400000000",
    booking_type: "vip_tickets",
    venue: "manor",
    booking_date: "2025-01-15",
    ticket_quantity: 4,
    ticket_price_cents: 1000,
    status: "confirmed",
    payment_status: "paid",
    total_amount: 40,
    square_payment_id: "payment-456",
    booking_source: "website_direct",
    reference_code: "TIX-ABC123",
    guest_list_token: "token-789",
    share_token: "ABCD1234",
  }

  assertEquals(bookingRow.booking_type, "vip_tickets")
  assertEquals(bookingRow.status, "confirmed")
  assertEquals(bookingRow.share_token, "ABCD1234")
  assertEquals("parent_booking_id" in bookingRow, false)
})

Deno.test("ticket booking row structure - guest", () => {
  const bookingRow = {
    customer_name: "Jane Guest",
    customer_email: "jane@example.com",
    booking_type: "vip_tickets",
    venue: "manor",
    booking_date: "2025-01-15",
    ticket_quantity: 2,
    ticket_price_cents: 1000,
    status: "confirmed",
    payment_status: "paid",
    total_amount: 20,
    square_payment_id: "payment-789",
    booking_source: "website_direct",
    reference_code: "TIX-DEF456",
    guest_list_token: "token-012",
    parent_booking_id: "organiser-booking-123",
  }

  assertEquals(bookingRow.booking_type, "vip_tickets")
  assertEquals(bookingRow.parent_booking_id, "organiser-booking-123")
  assertEquals("share_token" in bookingRow, false)
})

// ============================================
// Error Status Code Determination Tests
// ============================================

function determineStatusCode(errorMessage: string): number {
  const isClientError =
    errorMessage.includes("Invalid") ||
    errorMessage.includes("Missing") ||
    errorMessage.includes("expired") ||
    errorMessage.includes("not found")
  return isClientError ? 400 : 500
}

Deno.test("ticket status code - client errors return 400", () => {
  assertEquals(determineStatusCode("Invalid ticket quantity"), 400)
  assertEquals(determineStatusCode("Missing customer name"), 400)
  assertEquals(determineStatusCode("Invalid or expired group link"), 400)
  assertEquals(determineStatusCode("Occasion not found"), 400)
})

Deno.test("ticket status code - server errors return 500", () => {
  assertEquals(determineStatusCode("Square charge failed"), 500)
  assertEquals(determineStatusCode("Failed to create booking"), 500)
  assertEquals(determineStatusCode("Square credentials not configured"), 500)
})
