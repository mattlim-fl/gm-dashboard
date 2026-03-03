/**
 * Unit tests for error handling utilities
 * Run with: deno task test:errors
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  AppError,
  PaymentError,
  BookingError,
  ValidationError,
  AuthError,
  NotFoundError,
  ConfigError,
  getStatusCode,
  formatErrorResponse,
  errorResponse,
  sanitizeError,
  safeError,
  logError,
} from "../errors.ts"

// ============================================
// AppError Tests
// ============================================

Deno.test("AppError - creates with message and default status", () => {
  const error = new AppError("Something went wrong")
  assertEquals(error.message, "Something went wrong")
  assertEquals(error.statusCode, 500)
  assertEquals(error.name, "AppError")
  assertEquals(error.code, undefined)
})

Deno.test("AppError - creates with custom status code", () => {
  const error = new AppError("Bad request", 400)
  assertEquals(error.statusCode, 400)
})

Deno.test("AppError - creates with custom code", () => {
  const error = new AppError("Custom error", 500, "CUSTOM_CODE")
  assertEquals(error.code, "CUSTOM_CODE")
})

Deno.test("AppError - is instanceof Error", () => {
  const error = new AppError("Test")
  assertEquals(error instanceof Error, true)
  assertEquals(error instanceof AppError, true)
})

// ============================================
// PaymentError Tests
// ============================================

Deno.test("PaymentError - creates with message only", () => {
  const error = new PaymentError("Payment failed")
  assertEquals(error.message, "Payment failed")
  assertEquals(error.statusCode, 500)
  assertEquals(error.code, "PAYMENT_ERROR")
  assertEquals(error.name, "PaymentError")
  assertEquals(error.paymentId, undefined)
})

Deno.test("PaymentError - creates with payment ID", () => {
  const error = new PaymentError("Payment failed", "payment-123")
  assertEquals(error.paymentId, "payment-123")
})

Deno.test("PaymentError - creates with custom status", () => {
  const error = new PaymentError("Card declined", "payment-123", 402)
  assertEquals(error.statusCode, 402)
})

Deno.test("PaymentError - is instanceof AppError", () => {
  const error = new PaymentError("Test")
  assertEquals(error instanceof AppError, true)
  assertEquals(error instanceof PaymentError, true)
})

// ============================================
// BookingError Tests
// ============================================

Deno.test("BookingError - creates with message only", () => {
  const error = new BookingError("Booking failed")
  assertEquals(error.message, "Booking failed")
  assertEquals(error.statusCode, 500)
  assertEquals(error.code, "BOOKING_ERROR")
  assertEquals(error.name, "BookingError")
  assertEquals(error.bookingId, undefined)
})

Deno.test("BookingError - creates with booking ID", () => {
  const error = new BookingError("Booking failed", "booking-456")
  assertEquals(error.bookingId, "booking-456")
})

Deno.test("BookingError - creates with custom status", () => {
  const error = new BookingError("Booth unavailable", "booking-456", 409)
  assertEquals(error.statusCode, 409)
})

// ============================================
// ValidationError Tests
// ============================================

Deno.test("ValidationError - creates with message only", () => {
  const error = new ValidationError("Invalid input")
  assertEquals(error.message, "Invalid input")
  assertEquals(error.statusCode, 400) // Always 400
  assertEquals(error.code, "VALIDATION_ERROR")
  assertEquals(error.name, "ValidationError")
  assertEquals(error.field, undefined)
})

Deno.test("ValidationError - creates with field", () => {
  const error = new ValidationError("Invalid email format", "email")
  assertEquals(error.field, "email")
})

// ============================================
// AuthError Tests
// ============================================

Deno.test("AuthError - creates with default message", () => {
  const error = new AuthError()
  assertEquals(error.message, "Unauthorized")
  assertEquals(error.statusCode, 401)
  assertEquals(error.code, "AUTH_ERROR")
  assertEquals(error.name, "AuthError")
})

Deno.test("AuthError - creates with custom message", () => {
  const error = new AuthError("Invalid token")
  assertEquals(error.message, "Invalid token")
  assertEquals(error.statusCode, 401)
})

// ============================================
// NotFoundError Tests
// ============================================

Deno.test("NotFoundError - creates with message only", () => {
  const error = new NotFoundError("Resource not found")
  assertEquals(error.message, "Resource not found")
  assertEquals(error.statusCode, 404)
  assertEquals(error.code, "NOT_FOUND")
  assertEquals(error.name, "NotFoundError")
  assertEquals(error.resource, undefined)
})

Deno.test("NotFoundError - creates with resource", () => {
  const error = new NotFoundError("Booking not found", "booking")
  assertEquals(error.resource, "booking")
})

// ============================================
// ConfigError Tests
// ============================================

Deno.test("ConfigError - creates with message", () => {
  const error = new ConfigError("Missing API key")
  assertEquals(error.message, "Missing API key")
  assertEquals(error.statusCode, 500)
  assertEquals(error.code, "CONFIG_ERROR")
  assertEquals(error.name, "ConfigError")
})

// ============================================
// getStatusCode Tests
// ============================================

Deno.test("getStatusCode - returns statusCode from AppError", () => {
  assertEquals(getStatusCode(new AppError("Test", 418)), 418)
  assertEquals(getStatusCode(new PaymentError("Test")), 500)
  assertEquals(getStatusCode(new ValidationError("Test")), 400)
  assertEquals(getStatusCode(new AuthError("Test")), 401)
  assertEquals(getStatusCode(new NotFoundError("Test")), 404)
})

Deno.test("getStatusCode - infers 400 from 'invalid' message", () => {
  const error = new Error("Invalid parameter")
  assertEquals(getStatusCode(error), 400)
})

Deno.test("getStatusCode - infers 400 from 'missing' message", () => {
  const error = new Error("Missing required field")
  assertEquals(getStatusCode(error), 400)
})

Deno.test("getStatusCode - infers 401 from 'unauthorized' message", () => {
  const error = new Error("Unauthorized access")
  assertEquals(getStatusCode(error), 401)
})

Deno.test("getStatusCode - infers 403 from 'forbidden' message", () => {
  const error = new Error("Forbidden action")
  assertEquals(getStatusCode(error), 403)
})

Deno.test("getStatusCode - infers 404 from 'not found' message", () => {
  const error = new Error("Resource not found")
  assertEquals(getStatusCode(error), 404)
})

Deno.test("getStatusCode - infers 404 from 'expired' message", () => {
  const error = new Error("Token expired")
  assertEquals(getStatusCode(error), 404)
})

Deno.test("getStatusCode - infers 409 from 'conflict' message", () => {
  const error = new Error("Booking conflict")
  assertEquals(getStatusCode(error), 409)
})

Deno.test("getStatusCode - infers 409 from 'already exists' message", () => {
  const error = new Error("Record already exists")
  assertEquals(getStatusCode(error), 409)
})

Deno.test("getStatusCode - infers 429 from 'rate limit' message", () => {
  const error = new Error("Rate limit exceeded")
  assertEquals(getStatusCode(error), 429)
})

Deno.test("getStatusCode - infers 504 from 'timeout' message", () => {
  const error = new Error("Request timeout")
  assertEquals(getStatusCode(error), 504)
})

Deno.test("getStatusCode - infers 503 from 'unavailable' message", () => {
  const error = new Error("Service unavailable")
  assertEquals(getStatusCode(error), 503)
})

Deno.test("getStatusCode - returns 500 for unknown errors", () => {
  const error = new Error("Something unexpected")
  assertEquals(getStatusCode(error), 500)
})

Deno.test("getStatusCode - returns 500 for non-Error", () => {
  assertEquals(getStatusCode("string error"), 500)
  assertEquals(getStatusCode(null), 500)
  assertEquals(getStatusCode(undefined), 500)
})

// ============================================
// formatErrorResponse Tests
// ============================================

Deno.test("formatErrorResponse - formats AppError with code", () => {
  const error = new PaymentError("Payment failed", "pay-123")
  const response = formatErrorResponse(error)
  assertEquals(response.success, false)
  assertEquals(response.error, "Payment failed")
  assertEquals(response.code, "PAYMENT_ERROR")
})

Deno.test("formatErrorResponse - formats standard Error", () => {
  const error = new Error("Something broke")
  const response = formatErrorResponse(error)
  assertEquals(response.success, false)
  assertEquals(response.error, "Something broke")
  assertEquals(response.code, undefined)
})

Deno.test("formatErrorResponse - formats string error", () => {
  const response = formatErrorResponse("Raw string error")
  assertEquals(response.success, false)
  assertEquals(response.error, "Raw string error")
})

// ============================================
// errorResponse Tests
// ============================================

Deno.test("errorResponse - creates Response with correct status", async () => {
  const error = new ValidationError("Bad input")
  const response = errorResponse(error)

  assertEquals(response.status, 400)
  assertEquals(response.headers.get("Content-Type"), "application/json")

  const body = await response.json()
  assertEquals(body.success, false)
  assertEquals(body.error, "Bad input")
})

Deno.test("errorResponse - includes CORS headers", async () => {
  const error = new Error("Test error")
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST",
  }
  const response = errorResponse(error, corsHeaders)

  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*")
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "GET, POST")
})

// ============================================
// sanitizeError Tests
// ============================================

Deno.test("sanitizeError - redacts access_token", () => {
  const message = "Error with access_token=abc123def456"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("abc123def456"), false)
})

Deno.test("sanitizeError - redacts refresh_token", () => {
  const message = "Failed refresh_token:some-secret-token"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("some-secret-token"), false)
})

Deno.test("sanitizeError - redacts api_key", () => {
  const message = "Missing api_key=sk_live_12345"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("sk_live_12345"), false)
})

Deno.test("sanitizeError - redacts Bearer tokens", () => {
  const message = "Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "Bearer [REDACTED]")
  assertEquals(sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), false)
})

Deno.test("sanitizeError - redacts client_secret", () => {
  const message = "OAuth error client_secret=supersecret123"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("supersecret123"), false)
})

Deno.test("sanitizeError - redacts password", () => {
  const message = "Login failed password=mypassword123"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("mypassword123"), false)
})

Deno.test("sanitizeError - redacts Anthropic API keys (sk-)", () => {
  const message = "API call failed with sk-ant-api03-abcdef12345678901234"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("sk-ant-api03-abcdef12345678901234"), false)
})

Deno.test("sanitizeError - redacts Google access tokens (ya29.)", () => {
  const message = "Token error: ya29.a0AVvZVso_abcdefg_hijklmn"
  const sanitized = sanitizeError(message)
  assertStringIncludes(sanitized, "[REDACTED]")
  assertEquals(sanitized.includes("ya29.a0AVvZVso_abcdefg_hijklmn"), false)
})

Deno.test("sanitizeError - leaves non-sensitive content intact", () => {
  const message = "Booking for venue manor failed due to capacity"
  const sanitized = sanitizeError(message)
  assertEquals(sanitized, message)
})

Deno.test("sanitizeError - handles multiple sensitive values", () => {
  const message = "Error: access_token=abc123 and api_key=xyz789"
  const sanitized = sanitizeError(message)
  assertEquals(sanitized.includes("abc123"), false)
  assertEquals(sanitized.includes("xyz789"), false)
})

// ============================================
// safeError Tests
// ============================================

Deno.test("safeError - sanitizes Error message", () => {
  const error = new Error("Failed with api_key=secret123")
  const safe = safeError(error)
  assertStringIncludes(safe, "[REDACTED]")
  assertEquals(safe.includes("secret123"), false)
})

Deno.test("safeError - sanitizes string", () => {
  const safe = safeError("Token: Bearer abc123xyz")
  assertStringIncludes(safe, "[REDACTED]")
  assertEquals(safe.includes("abc123xyz"), false)
})

// ============================================
// logError Tests
// ============================================

Deno.test("logError - does not throw", () => {
  // Just verify it doesn't throw
  logError("test context", new Error("Test error"))
  logError("test context", "string error")
  logError("test context", new Error("Error with api_key=secret"), { extra: "data" })
})
