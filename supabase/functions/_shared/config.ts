/**
 * Centralized configuration for Supabase Edge Functions
 *
 * This module provides a single source of truth for all environment variables.
 * Use this instead of inline Deno.env.get() calls throughout edge functions.
 *
 * Required vars will throw on startup if missing, making deployment failures
 * explicit rather than hidden runtime errors.
 */

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

/**
 * Get a required environment variable, throwing if missing
 */
function requireEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

/**
 * Get an optional environment variable with a default value
 */
function optionalEnv(key: string, defaultValue?: string): string | undefined {
  return Deno.env.get(key) || defaultValue
}

/**
 * Centralized configuration object
 *
 * Access via: import { config } from "../_shared/config.ts"
 */
export const config = {
  // ─────────────────────────────────────────────────────────────────
  // Supabase (auto-injected by Supabase runtime)
  // ─────────────────────────────────────────────────────────────────
  get supabaseUrl(): string {
    return requireEnv('SUPABASE_URL')
  },
  get supabaseServiceKey(): string {
    // Try backup first (workaround for corrupted reserved secret)
    const backup = optionalEnv('SERVICE_ROLE_KEY_BACKUP')
    if (backup && backup.startsWith('eyJ')) {
      return backup
    }
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
  get supabaseAnonKey(): string | undefined {
    // Try backup first (workaround for corrupted reserved secret)
    const backup = optionalEnv('ANON_KEY_BACKUP')
    if (backup && backup.startsWith('eyJ')) {
      return backup
    }
    return optionalEnv('SUPABASE_ANON_KEY')
  },

  // ─────────────────────────────────────────────────────────────────
  // App Configuration
  // ─────────────────────────────────────────────────────────────────
  get appUrl(): string {
    return optionalEnv('APP_URL', 'http://localhost:5173')!
  },
  get apiBaseUrl(): string | undefined {
    return optionalEnv('API_BASE_URL')
  },
  get allowedOrigins(): string[] {
    const origins = optionalEnv('ALLOWED_ORIGINS', '')
    return origins ? origins.split(',').map(s => s.trim()).filter(Boolean) : []
  },

  // ─────────────────────────────────────────────────────────────────
  // Security & Encryption
  // ─────────────────────────────────────────────────────────────────
  get credentialsEncryptionKey(): string {
    return requireEnv('CREDENTIALS_ENCRYPTION_KEY')
  },
  get guestListSecret(): string {
    return optionalEnv('GUEST_LIST_SECRET', 'guest-list-secret')!
  },

  // ─────────────────────────────────────────────────────────────────
  // OAuth - Xero
  // ─────────────────────────────────────────────────────────────────
  get xeroClientId(): string | undefined {
    return optionalEnv('XERO_CLIENT_ID')
  },
  get xeroClientSecret(): string | undefined {
    return optionalEnv('XERO_CLIENT_SECRET')
  },

  // ─────────────────────────────────────────────────────────────────
  // OAuth - Gmail
  // ─────────────────────────────────────────────────────────────────
  get gmailClientId(): string | undefined {
    return optionalEnv('GMAIL_CLIENT_ID')
  },
  get gmailClientSecret(): string | undefined {
    return optionalEnv('GMAIL_CLIENT_SECRET')
  },

  // ─────────────────────────────────────────────────────────────────
  // API Keys
  // ─────────────────────────────────────────────────────────────────
  get anthropicApiKey(): string | undefined {
    return optionalEnv('ANTHROPIC_API_KEY')
  },
  get openaiApiKey(): string | undefined {
    return optionalEnv('OPENAI_API_KEY')
  },

  // ─────────────────────────────────────────────────────────────────
  // WhatsApp Business API
  // ─────────────────────────────────────────────────────────────────
  get whatsappApiKey(): string | undefined {
    return optionalEnv('WHATSAPP_BUSINESS_API_KEY')
  },
  get whatsappPhoneNumberId(): string | undefined {
    return optionalEnv('WHATSAPP_PHONE_NUMBER_ID')
  },

  // ─────────────────────────────────────────────────────────────────
  // Public APIs (for booking widgets)
  // ─────────────────────────────────────────────────────────────────
  get publicBookingApiKey(): string {
    return optionalEnv('PUBLIC_BOOKING_API_KEY', 'demo-api-key-2024')!
  },
}

/**
 * Helper to create a Supabase client with service role key
 * Use when you need admin access in edge functions
 */
export function getSupabaseConfig(): { url: string; serviceKey: string; anonKey?: string } {
  return {
    url: config.supabaseUrl,
    serviceKey: config.supabaseServiceKey,
    anonKey: config.supabaseAnonKey,
  }
}

/**
 * Check if Xero OAuth is configured
 */
export function isXeroConfigured(): boolean {
  return !!(config.xeroClientId && config.xeroClientSecret)
}

/**
 * Check if Gmail OAuth is configured
 */
export function isGmailConfigured(): boolean {
  return !!(config.gmailClientId && config.gmailClientSecret)
}

/**
 * Check if Anthropic API is configured
 */
export function isAnthropicConfigured(): boolean {
  return !!config.anthropicApiKey
}

/**
 * Check if WhatsApp is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!(config.whatsappApiKey && config.whatsappPhoneNumberId)
}
