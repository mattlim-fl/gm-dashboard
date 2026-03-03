/**
 * Unit tests for centralized config module
 * Run with: deno test --allow-env _shared/__tests__/config.test.ts
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

// ============================================
// Setup: Mock Deno.env for testing
// ============================================

// Store original env for restoration
const originalEnv = { ...Deno.env.toObject() }

function setEnv(key: string, value: string) {
  Deno.env.set(key, value)
}

function deleteEnv(key: string) {
  Deno.env.delete(key)
}

function restoreEnv() {
  // Clear all env vars
  for (const key of Object.keys(Deno.env.toObject())) {
    Deno.env.delete(key)
  }
  // Restore original
  for (const [key, value] of Object.entries(originalEnv)) {
    Deno.env.set(key, value)
  }
}

// ============================================
// Config Helper Functions Tests
// ============================================

Deno.test("config - isXeroConfigured returns true when both vars set", async () => {
  setEnv("XERO_CLIENT_ID", "test-client-id")
  setEnv("XERO_CLIENT_SECRET", "test-client-secret")

  // Dynamic import to get fresh config
  const { isXeroConfigured } = await import("../config.ts")

  assertEquals(isXeroConfigured(), true)

  restoreEnv()
})

Deno.test("config - isXeroConfigured returns false when client ID missing", async () => {
  deleteEnv("XERO_CLIENT_ID")
  setEnv("XERO_CLIENT_SECRET", "test-client-secret")

  const { isXeroConfigured } = await import("../config.ts")

  assertEquals(isXeroConfigured(), false)

  restoreEnv()
})

Deno.test("config - isXeroConfigured returns false when client secret missing", async () => {
  setEnv("XERO_CLIENT_ID", "test-client-id")
  deleteEnv("XERO_CLIENT_SECRET")

  const { isXeroConfigured } = await import("../config.ts")

  assertEquals(isXeroConfigured(), false)

  restoreEnv()
})

Deno.test("config - isGmailConfigured returns true when both vars set", async () => {
  setEnv("GMAIL_CLIENT_ID", "test-client-id")
  setEnv("GMAIL_CLIENT_SECRET", "test-client-secret")

  const { isGmailConfigured } = await import("../config.ts")

  assertEquals(isGmailConfigured(), true)

  restoreEnv()
})

Deno.test("config - isGmailConfigured returns false when missing vars", async () => {
  deleteEnv("GMAIL_CLIENT_ID")
  deleteEnv("GMAIL_CLIENT_SECRET")

  const { isGmailConfigured } = await import("../config.ts")

  assertEquals(isGmailConfigured(), false)

  restoreEnv()
})

Deno.test("config - isAnthropicConfigured returns true when API key set", async () => {
  setEnv("ANTHROPIC_API_KEY", "sk-ant-api03-test")

  const { isAnthropicConfigured } = await import("../config.ts")

  assertEquals(isAnthropicConfigured(), true)

  restoreEnv()
})

Deno.test("config - isAnthropicConfigured returns false when API key missing", async () => {
  deleteEnv("ANTHROPIC_API_KEY")

  const { isAnthropicConfigured } = await import("../config.ts")

  assertEquals(isAnthropicConfigured(), false)

  restoreEnv()
})

Deno.test("config - isWhatsAppConfigured returns true when both vars set", async () => {
  setEnv("WHATSAPP_BUSINESS_API_KEY", "test-api-key")
  setEnv("WHATSAPP_PHONE_NUMBER_ID", "123456789")

  const { isWhatsAppConfigured } = await import("../config.ts")

  assertEquals(isWhatsAppConfigured(), true)

  restoreEnv()
})

Deno.test("config - isWhatsAppConfigured returns false when missing vars", async () => {
  deleteEnv("WHATSAPP_BUSINESS_API_KEY")
  deleteEnv("WHATSAPP_PHONE_NUMBER_ID")

  const { isWhatsAppConfigured } = await import("../config.ts")

  assertEquals(isWhatsAppConfigured(), false)

  restoreEnv()
})

// ============================================
// Config Default Values Tests
// ============================================

Deno.test("config - appUrl defaults to localhost when not set", async () => {
  deleteEnv("APP_URL")

  const { config } = await import("../config.ts")

  assertEquals(config.appUrl, "http://localhost:5173")

  restoreEnv()
})

Deno.test("config - appUrl uses env value when set", async () => {
  setEnv("APP_URL", "https://myapp.com")

  const { config } = await import("../config.ts")

  assertEquals(config.appUrl, "https://myapp.com")

  restoreEnv()
})

Deno.test("config - guestListSecret has default value", async () => {
  deleteEnv("GUEST_LIST_SECRET")

  const { config } = await import("../config.ts")

  assertEquals(config.guestListSecret, "guest-list-secret")

  restoreEnv()
})

Deno.test("config - guestListSecret uses env value when set", async () => {
  setEnv("GUEST_LIST_SECRET", "my-custom-secret")

  const { config } = await import("../config.ts")

  assertEquals(config.guestListSecret, "my-custom-secret")

  restoreEnv()
})

Deno.test("config - publicBookingApiKey has default value", async () => {
  deleteEnv("PUBLIC_BOOKING_API_KEY")

  const { config } = await import("../config.ts")

  assertEquals(config.publicBookingApiKey, "demo-api-key-2024")

  restoreEnv()
})

Deno.test("config - allowedOrigins returns empty array when not set", async () => {
  deleteEnv("ALLOWED_ORIGINS")

  const { config } = await import("../config.ts")

  assertEquals(config.allowedOrigins, [])

  restoreEnv()
})

Deno.test("config - allowedOrigins parses comma-separated list", async () => {
  setEnv("ALLOWED_ORIGINS", "https://app1.com, https://app2.com, https://app3.com")

  const { config } = await import("../config.ts")

  assertEquals(config.allowedOrigins, [
    "https://app1.com",
    "https://app2.com",
    "https://app3.com",
  ])

  restoreEnv()
})

Deno.test("config - allowedOrigins filters empty values", async () => {
  setEnv("ALLOWED_ORIGINS", "https://app1.com, , https://app2.com, ")

  const { config } = await import("../config.ts")

  assertEquals(config.allowedOrigins, [
    "https://app1.com",
    "https://app2.com",
  ])

  restoreEnv()
})

// ============================================
// getSupabaseConfig Tests
// ============================================

Deno.test("getSupabaseConfig - returns url and serviceKey", async () => {
  setEnv("SUPABASE_URL", "https://test.supabase.co")
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJtest123")

  const { getSupabaseConfig } = await import("../config.ts")
  const result = getSupabaseConfig()

  assertEquals(result.url, "https://test.supabase.co")
  assertEquals(result.serviceKey, "eyJtest123")

  restoreEnv()
})

Deno.test("getSupabaseConfig - includes anonKey when set", async () => {
  setEnv("SUPABASE_URL", "https://test.supabase.co")
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJtest123")
  setEnv("SUPABASE_ANON_KEY", "eyJanon456")

  const { getSupabaseConfig } = await import("../config.ts")
  const result = getSupabaseConfig()

  assertEquals(result.anonKey, "eyJanon456")

  restoreEnv()
})

// ============================================
// Backup Key Tests
// ============================================

Deno.test("config - supabaseServiceKey prefers backup when valid", async () => {
  setEnv("SERVICE_ROLE_KEY_BACKUP", "eyJbackup123")
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJoriginal456")

  const { config } = await import("../config.ts")

  assertEquals(config.supabaseServiceKey, "eyJbackup123")

  restoreEnv()
})

Deno.test("config - supabaseServiceKey falls back to original when backup invalid", async () => {
  setEnv("SERVICE_ROLE_KEY_BACKUP", "not-a-jwt")
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJoriginal456")

  const { config } = await import("../config.ts")

  assertEquals(config.supabaseServiceKey, "eyJoriginal456")

  restoreEnv()
})

Deno.test("config - supabaseAnonKey prefers backup when valid", async () => {
  setEnv("ANON_KEY_BACKUP", "eyJbackup789")
  setEnv("SUPABASE_ANON_KEY", "eyJoriginal012")

  const { config } = await import("../config.ts")

  assertEquals(config.supabaseAnonKey, "eyJbackup789")

  restoreEnv()
})
