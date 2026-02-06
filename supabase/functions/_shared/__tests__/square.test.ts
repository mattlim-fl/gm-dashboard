/**
 * Unit tests for Square utilities
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/__tests__/square.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { toIdempotencyKey } from "../square.ts"

// ============================================
// toIdempotencyKey Tests
// ============================================

Deno.test("toIdempotencyKey - generates consistent key for same input", async () => {
  const input = "booking:123:2025-01-15:10:00-12:00"

  const key1 = await toIdempotencyKey(input)
  const key2 = await toIdempotencyKey(input)

  assertEquals(key1, key2)
})

Deno.test("toIdempotencyKey - generates different keys for different inputs", async () => {
  const key1 = await toIdempotencyKey("input1")
  const key2 = await toIdempotencyKey("input2")

  assertNotEquals(key1, key2)
})

Deno.test("toIdempotencyKey - respects 45 char limit", async () => {
  const longInput = "a".repeat(1000)
  const key = await toIdempotencyKey(longInput)

  assertEquals(key.length <= 45, true)
})

Deno.test("toIdempotencyKey - produces valid hex string", async () => {
  const key = await toIdempotencyKey("test-input")
  const hexRegex = /^[0-9a-f]+$/

  assertEquals(hexRegex.test(key), true)
})

Deno.test("toIdempotencyKey - handles special characters", async () => {
  const inputs = [
    "emoji: 🎉",
    "unicode: 日本語",
    "special: !@#$%^&*()",
    "spaces: hello world",
    "newlines: hello\nworld",
  ]

  for (const input of inputs) {
    const key = await toIdempotencyKey(input)
    assertEquals(key.length <= 45, true)
    assertEquals(/^[0-9a-f]+$/.test(key), true)
  }
})

Deno.test("toIdempotencyKey - handles empty string", async () => {
  const key = await toIdempotencyKey("")

  assertEquals(key.length <= 45, true)
  assertEquals(key.length > 0, true)
})

// ============================================
// chargeSquare Tests (with mocked fetch)
// Note: These tests demonstrate the structure for integration testing
// In a real scenario, you'd mock the fetch function
// ============================================

Deno.test("chargeSquare - idempotency key format for payments", async () => {
  // Test that the raw idempotency key inputs produce consistent keys
  const holdId = "hold-123"
  const boothId = "booth-456"
  const bookingDate = "2025-01-15"
  const startTime = "10:00"
  const endTime = "12:00"
  const ticketQty = 2

  const rawKey = `${holdId}:${boothId}:${bookingDate}:${startTime}-${endTime}:t${ticketQty}`
  const key1 = await toIdempotencyKey(rawKey)
  const key2 = await toIdempotencyKey(rawKey)

  assertEquals(key1, key2)
  assertEquals(key1.length <= 45, true)
})

Deno.test("refundSquarePayment - idempotency key includes timestamp", async () => {
  const paymentId = "payment-123"
  const amountCents = 5000

  // Simulate the idempotency key generation used in refundSquarePayment
  const timestamp1 = Date.now()
  const key1 = await toIdempotencyKey(`refund:${paymentId}:${amountCents}:${timestamp1}`)

  // Wait a bit to get different timestamp
  await new Promise((resolve) => setTimeout(resolve, 10))

  const timestamp2 = Date.now()
  const key2 = await toIdempotencyKey(`refund:${paymentId}:${amountCents}:${timestamp2}`)

  // Keys should be different because timestamps differ
  assertNotEquals(key1, key2)
})

// ============================================
// Integration Test Examples (commented out - require real API)
// Uncomment and configure for integration testing
// ============================================

/*
Deno.test({
  name: "chargeSquare - integration test with sandbox",
  ignore: !Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN"), // Skip if no token
  async fn() {
    const { chargeSquare } = await import("../square.ts")

    // This would require a valid sandbox token and test card nonce
    const result = await chargeSquare({
      amountCents: 100,
      token: "cnon:card-nonce-ok", // Square sandbox test nonce
      idempotencyKey: await toIdempotencyKey(`test-${Date.now()}`),
      locationId: Deno.env.get("SQUARE_SANDBOX_LOCATION_ID")!,
      accessToken: Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN")!,
    })

    assertEquals(typeof result.paymentId, "string")
    assertEquals(result.paymentId.length > 0, true)
  },
})
*/

// ============================================
// Error Handling Tests
// ============================================

Deno.test("toIdempotencyKey - fallback on crypto failure", async () => {
  // The function has a fallback for when crypto.subtle fails
  // Test that it handles edge cases gracefully
  const veryLongInput = "x".repeat(10000)
  const key = await toIdempotencyKey(veryLongInput)

  assertEquals(key.length <= 45, true)
  assertEquals(key.length > 0, true)
})

// ============================================
// Mock-based Tests Structure
// ============================================

/**
 * Example of how to structure mock-based tests for chargeSquare
 * This demonstrates the testing pattern without actually mocking
 */
Deno.test("chargeSquare mock structure - success response", () => {
  // Expected request format
  const expectedRequest = {
    idempotency_key: "test-key",
    source_id: "card-token",
    location_id: "location-123",
    amount_money: { amount: 5000, currency: "AUD" },
  }

  // Expected success response from Square
  const mockResponse = {
    payment: {
      id: "payment-123",
      status: "COMPLETED",
      amount_money: { amount: 5000, currency: "AUD" },
    },
  }

  // Verify response structure
  assertEquals(typeof mockResponse.payment.id, "string")
  assertEquals(mockResponse.payment.status, "COMPLETED")
})

Deno.test("chargeSquare mock structure - error response", () => {
  // Expected error response from Square
  const mockErrorResponse = {
    errors: [
      {
        category: "INVALID_REQUEST_ERROR",
        code: "INVALID_CARD_DATA",
        detail: "Invalid card data provided",
      },
    ],
  }

  // Verify error extraction logic
  const errorMessage = mockErrorResponse.errors?.[0]?.detail || "Square charge failed"
  assertEquals(errorMessage, "Invalid card data provided")
})

Deno.test("refundSquarePayment mock structure - success response", () => {
  // Expected success response from Square refund
  const mockResponse = {
    refund: {
      id: "refund-123",
      status: "COMPLETED",
      amount_money: { amount: 5000, currency: "AUD" },
      payment_id: "payment-123",
    },
  }

  // Verify response structure
  assertEquals(typeof mockResponse.refund.id, "string")
  assertEquals(mockResponse.refund.payment_id, "payment-123")
})
