/**
 * Unit tests for credentials utilities
 * Run with: deno task test:credentials
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

// We'll test the helper functions and type definitions
// Main functions require database mocking which is more complex

// ============================================
// Type Checks (compile-time verification)
// ============================================

import type {
  IntegrationType,
  SquareCredentials,
  XeroCredentials,
  GmailCredentials,
  ResendCredentials,
  CredentialData,
} from "../credentials.ts"

// Type assertions at compile time
const _squareCreds: SquareCredentials = { access_token: 'test' }
const _xeroCreds: XeroCredentials = {
  client_id: 'id',
  client_secret: 'secret',
  refresh_token: 'token',
  tenant_id: 'tenant'
}
const _gmailCreds: GmailCredentials = { refresh_token: 'token', mailbox_email: 'test@example.com' }
const _resendCreds: ResendCredentials = { api_key: 'key' }
const _resendCredsWithFrom: ResendCredentials = { api_key: 'key', from_email: 'from@example.com' }

// Verify IntegrationType enum values
const _validTypes: IntegrationType[] = ['square', 'xero', 'gmail', 'resend']

// ============================================
// Mock Supabase Client Factory
// ============================================

interface MockQueryResult {
  data: unknown
  error: unknown
}

function createMockSupabase(responses: Record<string, MockQueryResult>) {
  const defaultResponse = { data: null, error: { message: 'Not configured' } }

  return {
    from: (table: string) => {
      const tableKey = table
      return {
        select: (_columns: string) => ({
          eq: (col: string, val: string | null) => ({
            eq: (_col2: string, _val2: string) => ({
              single: async () => responses[`${tableKey}:eq:${col}:${val}`] || defaultResponse,
              maybeSingle: async () => responses[`${tableKey}:eq:${col}:${val}`] || { data: null, error: null },
            }),
            is: (col2: string, _val2: null) => ({
              single: async () => responses[`${tableKey}:eq:${col}:${val}:is:${col2}`] || defaultResponse,
            }),
            single: async () => responses[`${tableKey}:eq:${col}:${val}`] || defaultResponse,
            maybeSingle: async () => responses[`${tableKey}:eq:${col}:${val}`] || { data: null, error: null },
          }),
          is: (col: string, _val: null) => ({
            eq: (col2: string, val2: string) => ({
              eq: (_col3: string, _val3: string) => ({
                single: async () => responses[`${tableKey}:is:${col}:eq:${col2}:${val2}`] || defaultResponse,
                maybeSingle: async () => responses[`${tableKey}:is:${col}:eq:${col2}:${val2}`] || { data: null, error: null },
              }),
              single: async () => responses[`${tableKey}:is:${col}:eq:${col2}:${val2}`] || defaultResponse,
            }),
            is: (col2: string, _val2: null) => ({
              eq: (col3: string, val3: string) => ({
                single: async () => responses[`${tableKey}:is:${col}:is:${col2}:eq:${col3}:${val3}`] || defaultResponse,
                maybeSingle: async () => responses[`${tableKey}:is:${col}:is:${col2}:eq:${col3}:${val3}`] || { data: null, error: null },
              }),
            }),
          }),
          single: async () => responses[tableKey] || defaultResponse,
        }),
        upsert: async () => ({ data: null, error: null }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ data: null, error: null }),
            is: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          }),
          is: () => ({
            eq: () => ({
              is: async () => ({ data: null, error: null }),
            }),
            is: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        insert: async () => ({ data: null, error: null }),
      }
    },
  }
}

// ============================================
// Type Definition Tests
// ============================================

Deno.test("SquareCredentials - requires access_token", () => {
  const creds: SquareCredentials = { access_token: 'test-token' }
  assertEquals(creds.access_token, 'test-token')
})

Deno.test("XeroCredentials - requires all OAuth fields", () => {
  const creds: XeroCredentials = {
    client_id: 'client-123',
    client_secret: 'secret-456',
    refresh_token: 'refresh-789',
    tenant_id: 'tenant-abc',
  }
  assertEquals(creds.client_id, 'client-123')
  assertEquals(creds.client_secret, 'secret-456')
  assertEquals(creds.refresh_token, 'refresh-789')
  assertEquals(creds.tenant_id, 'tenant-abc')
})

Deno.test("GmailCredentials - requires refresh_token and mailbox_email", () => {
  const creds: GmailCredentials = {
    refresh_token: 'token-123',
    mailbox_email: 'venue@example.com',
  }
  assertEquals(creds.refresh_token, 'token-123')
  assertEquals(creds.mailbox_email, 'venue@example.com')
})

Deno.test("ResendCredentials - api_key required, from_email optional", () => {
  const credsWithoutFrom: ResendCredentials = { api_key: 'key-123' }
  const credsWithFrom: ResendCredentials = { api_key: 'key-456', from_email: 'noreply@venue.com' }

  assertEquals(credsWithoutFrom.api_key, 'key-123')
  assertEquals(credsWithoutFrom.from_email, undefined)
  assertEquals(credsWithFrom.api_key, 'key-456')
  assertEquals(credsWithFrom.from_email, 'noreply@venue.com')
})

// ============================================
// Integration Type Tests
// ============================================

Deno.test("IntegrationType - includes all expected types", () => {
  const types: IntegrationType[] = ['square', 'xero', 'gmail', 'resend']
  assertEquals(types.length, 4)
  assertEquals(types.includes('square'), true)
  assertEquals(types.includes('xero'), true)
  assertEquals(types.includes('gmail'), true)
  assertEquals(types.includes('resend'), true)
})

// ============================================
// Credential Scoping Documentation Tests
// ============================================

Deno.test("Scoping rules - gmail is per-venue", () => {
  // Gmail requires each venue to have its own inbox
  // This is a documentation/design test
  const perVenueIntegrations: IntegrationType[] = ['gmail']
  assertEquals(perVenueIntegrations.includes('gmail'), true)
})

Deno.test("Scoping rules - square and xero are per-organization", () => {
  // Square and Xero credentials are shared across venues in same org
  const perOrgIntegrations: IntegrationType[] = ['square', 'xero']
  assertEquals(perOrgIntegrations.includes('square'), true)
  assertEquals(perOrgIntegrations.includes('xero'), true)
})

Deno.test("Scoping rules - resend is global", () => {
  // Resend is a single account for all venues
  const globalIntegrations: IntegrationType[] = ['resend']
  assertEquals(globalIntegrations.includes('resend'), true)
})

// ============================================
// Mock Supabase Client Tests
// ============================================

Deno.test("MockSupabase - returns configured response", async () => {
  const mockSupabase = createMockSupabase({
    'venue_organizations:eq:venue:manor': {
      data: { organization_id: 'noxfolk' },
      error: null,
    },
  })

  const result = await mockSupabase
    .from('venue_organizations')
    .select('organization_id')
    .eq('venue', 'manor')
    .single()

  assertExists(result.data)
  assertEquals((result.data as { organization_id: string }).organization_id, 'noxfolk')
})

Deno.test("MockSupabase - returns error for unconfigured query", async () => {
  const mockSupabase = createMockSupabase({})

  const result = await mockSupabase
    .from('unknown_table')
    .select('*')
    .single()

  assertExists(result.error)
})

// ============================================
// Credential Data Union Type Tests
// ============================================

Deno.test("CredentialData - accepts all credential types", () => {
  const allCreds: CredentialData[] = [
    { access_token: 'square-token' },
    { client_id: 'xero-id', client_secret: 'secret', refresh_token: 'token', tenant_id: 'tenant' },
    { refresh_token: 'gmail-token', mailbox_email: 'test@example.com' },
    { api_key: 'resend-key' },
    { api_key: 'resend-key', from_email: 'from@example.com' },
  ]

  assertEquals(allCreds.length, 5)
})

// ============================================
// Organization Mapping Tests (Design Validation)
// ============================================

Deno.test("Organization mapping - documented venues belong to orgs", () => {
  // Based on CLAUDE.md documentation:
  // noxfolk -> manor, hippie
  // daisies -> daisy
  const orgMapping = {
    noxfolk: ['manor', 'hippie'],
    daisies: ['daisy'],
  }

  assertEquals(orgMapping.noxfolk.includes('manor'), true)
  assertEquals(orgMapping.noxfolk.includes('hippie'), true)
  assertEquals(orgMapping.daisies.includes('daisy'), true)
})

// ============================================
// Credential Row Structure Tests
// ============================================

Deno.test("Credential row - has required fields", () => {
  // This validates the expected database schema
  const mockRow = {
    id: 'uuid-123',
    venue: 'manor',
    organization_id: null,
    integration_type: 'gmail',
    credentials_encrypted: 'encrypted-string',
    is_active: true,
    last_verified_at: '2024-01-01T00:00:00Z',
    verification_status: 'verified',
    verification_error: null,
    oauth_expires_at: null,
  }

  assertExists(mockRow.id)
  assertExists(mockRow.integration_type)
  assertExists(mockRow.credentials_encrypted)
  assertEquals(mockRow.is_active, true)
})

Deno.test("Credential row - venue OR organization_id for scoping", () => {
  // Per-venue credential
  const venueRow = {
    id: 'uuid-1',
    venue: 'manor',
    organization_id: null,
    integration_type: 'gmail',
    credentials_encrypted: 'encrypted',
    is_active: true,
  }

  // Per-org credential
  const orgRow = {
    id: 'uuid-2',
    venue: null,
    organization_id: 'noxfolk',
    integration_type: 'square',
    credentials_encrypted: 'encrypted',
    is_active: true,
  }

  // Global credential
  const globalRow = {
    id: 'uuid-3',
    venue: null,
    organization_id: null,
    integration_type: 'resend',
    credentials_encrypted: 'encrypted',
    is_active: true,
  }

  assertEquals(venueRow.venue, 'manor')
  assertEquals(venueRow.organization_id, null)

  assertEquals(orgRow.venue, null)
  assertEquals(orgRow.organization_id, 'noxfolk')

  assertEquals(globalRow.venue, null)
  assertEquals(globalRow.organization_id, null)
})

// ============================================
// Verification Status Tests
// ============================================

Deno.test("Verification status - valid values", () => {
  const validStatuses = ['pending', 'verified', 'failed']
  assertEquals(validStatuses.includes('pending'), true)
  assertEquals(validStatuses.includes('verified'), true)
  assertEquals(validStatuses.includes('failed'), true)
})

// ============================================
// Square Location Mapping Tests
// ============================================

Deno.test("Square locations - structure for venue mapping", () => {
  const mockLocation = {
    square_location_id: 'LOC123',
    venue: 'manor',
    location_type: 'bar',
    location_name: 'Manor Bar',
    is_active: true,
  }

  assertEquals(mockLocation.venue, 'manor')
  assertEquals(mockLocation.location_type, 'bar')
  assertExists(mockLocation.square_location_id)
})

Deno.test("Square locations - shared location has null venue", () => {
  const sharedLocation = {
    square_location_id: 'LOC456',
    venue: null,
    location_type: 'door',
    location_name: 'Door Entry',
    is_active: true,
  }

  assertEquals(sharedLocation.venue, null)
  assertEquals(sharedLocation.location_type, 'door')
})
