/**
 * Unit tests for crypto utilities
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/crypto.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  hmacSha256,
  generateSecureCode,
  generateGuestListToken,
  verifyGuestListToken,
  encryptToken,
  decryptToken,
} from "../crypto.ts"

// ============================================
// hmacSha256 Tests
// ============================================

Deno.test("hmacSha256 - generates consistent hash for same input", async () => {
  const message = "test message"
  const secret = "test-secret"

  const hash1 = await hmacSha256(message, secret)
  const hash2 = await hmacSha256(message, secret)

  assertEquals(hash1, hash2)
  assertEquals(hash1.length, 64) // SHA-256 produces 64 hex chars
})

Deno.test("hmacSha256 - generates different hash for different messages", async () => {
  const secret = "test-secret"

  const hash1 = await hmacSha256("message1", secret)
  const hash2 = await hmacSha256("message2", secret)

  assertNotEquals(hash1, hash2)
})

Deno.test("hmacSha256 - generates different hash for different secrets", async () => {
  const message = "test message"

  const hash1 = await hmacSha256(message, "secret1")
  const hash2 = await hmacSha256(message, "secret2")

  assertNotEquals(hash1, hash2)
})

// ============================================
// generateSecureCode Tests
// ============================================

Deno.test("generateSecureCode - generates code of specified length", () => {
  const code6 = generateSecureCode(6)
  const code8 = generateSecureCode(8)
  const code12 = generateSecureCode(12)

  assertEquals(code6.length, 6)
  assertEquals(code8.length, 8)
  assertEquals(code12.length, 12)
})

Deno.test("generateSecureCode - uses default alphabet", () => {
  const defaultAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const code = generateSecureCode(100) // Long code to test all chars

  for (const char of code) {
    assertEquals(defaultAlphabet.includes(char), true, `Unexpected char: ${char}`)
  }
})

Deno.test("generateSecureCode - uses custom alphabet", () => {
  const customAlphabet = "ABC123"
  const code = generateSecureCode(50, customAlphabet)

  for (const char of code) {
    assertEquals(customAlphabet.includes(char), true, `Unexpected char: ${char}`)
  }
})

Deno.test("generateSecureCode - generates different codes each time", () => {
  const codes = new Set<string>()

  // Generate 100 codes and check uniqueness
  for (let i = 0; i < 100; i++) {
    codes.add(generateSecureCode(8))
  }

  // Should have at least 95 unique codes (allowing for tiny collision chance)
  assertEquals(codes.size >= 95, true, `Only ${codes.size} unique codes generated`)
})

// ============================================
// generateGuestListToken / verifyGuestListToken Tests
// ============================================

Deno.test("generateGuestListToken - creates valid token format", async () => {
  const bookingId = "test-booking-123"
  const bookingDate = "2025-12-31"
  const secret = "test-secret"

  const token = await generateGuestListToken(bookingId, bookingDate, secret)
  const parts = token.split(".")

  assertEquals(parts.length, 3)
  assertEquals(parts[0], bookingId)
  assertEquals(parts[1].length > 0, true) // expiry timestamp
  assertEquals(parts[2].length, 64) // HMAC-SHA256 signature
})

Deno.test("verifyGuestListToken - verifies valid token", async () => {
  const bookingId = "test-booking-456"
  const bookingDate = "2099-12-31" // Far future date to ensure not expired
  const secret = "test-secret"

  const token = await generateGuestListToken(bookingId, bookingDate, secret)
  const verified = await verifyGuestListToken(token, secret)

  assertEquals(verified, bookingId)
})

Deno.test("verifyGuestListToken - rejects invalid signature", async () => {
  const bookingId = "test-booking-789"
  const bookingDate = "2099-12-31"
  const secret = "test-secret"

  const token = await generateGuestListToken(bookingId, bookingDate, secret)
  const verified = await verifyGuestListToken(token, "wrong-secret")

  assertEquals(verified, null)
})

Deno.test("verifyGuestListToken - rejects malformed token", async () => {
  const secret = "test-secret"

  const result1 = await verifyGuestListToken("invalid", secret)
  const result2 = await verifyGuestListToken("only.two", secret)
  const result3 = await verifyGuestListToken("", secret)

  assertEquals(result1, null)
  assertEquals(result2, null)
  assertEquals(result3, null)
})

Deno.test("verifyGuestListToken - rejects expired token", async () => {
  const bookingId = "test-booking-expired"
  const secret = "test-secret"

  // Create a token that's already expired (expiry in the past)
  const pastExpiry = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  const sig = await hmacSha256(`${bookingId}${pastExpiry}`, secret)
  const expiredToken = `${bookingId}.${pastExpiry}.${sig}`

  const verified = await verifyGuestListToken(expiredToken, secret)

  assertEquals(verified, null)
})

// ============================================
// encryptToken / decryptToken Tests
// ============================================

Deno.test("encryptToken/decryptToken - round trip encryption", async () => {
  const plaintext = "sensitive-refresh-token-12345"
  const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" // 64 hex chars

  const encrypted = await encryptToken(plaintext, encryptionKey)
  const decrypted = await decryptToken(encrypted, encryptionKey)

  assertEquals(decrypted, plaintext)
})

Deno.test("encryptToken - produces different ciphertext each time (random IV)", async () => {
  const plaintext = "test-token"
  const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

  const encrypted1 = await encryptToken(plaintext, encryptionKey)
  const encrypted2 = await encryptToken(plaintext, encryptionKey)

  assertNotEquals(encrypted1, encrypted2)
})

Deno.test("encryptToken/decryptToken - works with non-hex key (hashed)", async () => {
  const plaintext = "another-secret-token"
  const encryptionKey = "my-simple-password-key" // Will be SHA-256 hashed

  const encrypted = await encryptToken(plaintext, encryptionKey)
  const decrypted = await decryptToken(encrypted, encryptionKey)

  assertEquals(decrypted, plaintext)
})

Deno.test("decryptToken - fails with wrong key", async () => {
  const plaintext = "secret-data"
  const encryptionKey1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  const encryptionKey2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"

  const encrypted = await encryptToken(plaintext, encryptionKey1)

  await assertRejects(
    async () => await decryptToken(encrypted, encryptionKey2),
    Error
  )
})

Deno.test("encryptToken/decryptToken - handles unicode content", async () => {
  const plaintext = "Hello 世界 🎉 émojis"
  const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

  const encrypted = await encryptToken(plaintext, encryptionKey)
  const decrypted = await decryptToken(encrypted, encryptionKey)

  assertEquals(decrypted, plaintext)
})

Deno.test("encryptToken/decryptToken - handles empty string", async () => {
  const plaintext = ""
  const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

  const encrypted = await encryptToken(plaintext, encryptionKey)
  const decrypted = await decryptToken(encrypted, encryptionKey)

  assertEquals(decrypted, plaintext)
})

Deno.test("encryptToken/decryptToken - handles long content", async () => {
  const plaintext = "x".repeat(10000) // 10KB of data
  const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

  const encrypted = await encryptToken(plaintext, encryptionKey)
  const decrypted = await decryptToken(encrypted, encryptionKey)

  assertEquals(decrypted, plaintext)
})
