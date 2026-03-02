/**
 * Shared credentials module for Supabase Edge Functions
 * Handles fetching, encrypting, and saving API credentials with flexible scoping:
 * - Per-venue: Square, Gmail
 * - Per-organization: Xero
 * - Global: Resend
 */

import { encryptToken, decryptToken } from './crypto.ts'

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

// Integration types
export type IntegrationType = 'square' | 'xero' | 'gmail' | 'resend'

// Credential scoping: which integrations use which scope level
// - Per-venue: gmail (each venue has its own inbox)
// - Per-organization: square, xero (org shares one account across venues)
// - Global: resend (single account for all)

// Credential structures for each integration
export interface SquareCredentials {
  access_token: string
  // Note: location_id is stored in square_locations table, not in credentials
  // since one Square account (per-org) can have multiple locations
}

export interface XeroCredentials {
  client_id: string
  client_secret: string
  refresh_token: string
  tenant_id: string
}

export interface GmailCredentials {
  refresh_token: string
  mailbox_email: string
}

export interface ResendCredentials {
  api_key: string
  from_email?: string
}

// Union type for all credential types
export type CredentialData = SquareCredentials | XeroCredentials | GmailCredentials | ResendCredentials

// Database row type
interface CredentialRow {
  id: string
  venue: string | null
  organization_id: string | null
  integration_type: string
  credentials_encrypted: string
  is_active: boolean
  last_verified_at: string | null
  verification_status: string | null
  verification_error: string | null
  oauth_expires_at: string | null
}

// Supabase client interface (minimal)
interface SupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | null) => {
        is: (column: string, value: null) => {
          single: () => Promise<{ data: unknown; error: unknown }>
        }
        single: () => Promise<{ data: unknown; error: unknown }>
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      }
      is: (column: string, value: null) => {
        is: (column: string, value: null) => {
          eq: (column: string, value: string) => {
            single: () => Promise<{ data: unknown; error: unknown }>
          }
        }
        eq: (column: string, value: string) => {
          single: () => Promise<{ data: unknown; error: unknown }>
        }
      }
      single: () => Promise<{ data: unknown; error: unknown }>
    }
    upsert: (data: unknown, options?: { onConflict?: string }) => Promise<{ data: unknown; error: unknown }>
    update: (data: unknown) => {
      eq: (column: string, value: string | null) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>
        is: (column: string, value: null) => {
          eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>
        }
      }
      is: (column: string, value: null) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => Promise<{ data: unknown; error: unknown }>
        }
        is: (column: string, value: null) => {
          eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>
        }
      }
    }
    insert: (data: unknown) => Promise<{ data: unknown; error: unknown }>
  }
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): string {
  const key = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') || Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY or TOKEN_ENCRYPTION_KEY environment variable is required')
  }
  return key
}

/**
 * Get the organization ID for a venue
 */
async function getOrganizationForVenue(supabase: SupabaseClient, venue: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('venue_organizations')
    .select('organization_id')
    .eq('venue', venue)
    .single()

  if (error || !data) return null
  return (data as { organization_id: string }).organization_id
}

/**
 * Get credentials for a specific integration type and venue
 * Uses appropriate scoping based on integration type:
 * - square, gmail: per-venue
 * - xero: per-organization (looks up venue's org first)
 * - resend: global (venue and org are both null)
 */
export async function getCredentials<T extends CredentialData>(
  supabase: SupabaseClient,
  venue: string | null,
  integrationType: IntegrationType
): Promise<T | null> {
  try {
    let data: CredentialRow | null = null
    let error: unknown = null

    if (integrationType === 'gmail') {
      // Per-venue credentials - each venue has its own inbox
      if (!venue) {
        console.warn(`getCredentials: venue required for ${integrationType}`)
        return null
      }
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .eq('venue', venue)
        .eq('integration_type', integrationType)
        .single()
      data = result.data as CredentialRow | null
      error = result.error
    } else if (integrationType === 'square' || integrationType === 'xero') {
      // Per-organization credentials - org shares one account across venues
      if (!venue) {
        console.warn(`getCredentials: venue required for ${integrationType} lookup`)
        return null
      }
      const orgId = await getOrganizationForVenue(supabase, venue)
      if (!orgId) {
        console.warn(`getCredentials: no organization found for venue ${venue}`)
        return null
      }
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .is('venue', null)
        .eq('organization_id', orgId)
        .eq('integration_type', integrationType)
        .single()
      data = result.data as CredentialRow | null
      error = result.error
    } else if (integrationType === 'resend') {
      // Global credentials (venue and org are both null)
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .is('venue', null)
        .is('organization_id', null)
        .eq('integration_type', 'resend')
        .single()
      data = result.data as CredentialRow | null
      error = result.error
    }

    if (error || !data) {
      console.log(`No credentials found for ${integrationType} (venue: ${venue})`)
      return null
    }

    if (!data.is_active) {
      console.log(`Credentials for ${integrationType} are inactive`)
      return null
    }

    // Decrypt the credentials
    const encryptionKey = getEncryptionKey()
    const decrypted = await decryptToken(data.credentials_encrypted, encryptionKey)
    return JSON.parse(decrypted) as T
  } catch (err) {
    console.error(`Error fetching credentials for ${integrationType}:`, err)
    return null
  }
}

/**
 * Save credentials for a specific integration type
 * Uses appropriate scoping based on integration type
 */
export async function saveCredentials<T extends CredentialData>(
  supabase: SupabaseClient,
  venue: string | null,
  integrationType: IntegrationType,
  credentials: T,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const encryptionKey = getEncryptionKey()
    const encrypted = await encryptToken(JSON.stringify(credentials), encryptionKey)

    let scopeData: { venue: string | null; organization_id: string | null }

    if (integrationType === 'gmail') {
      // Per-venue credentials - each venue has its own inbox
      if (!venue) {
        return { success: false, error: `Venue required for ${integrationType} credentials` }
      }
      scopeData = { venue, organization_id: null }
    } else if (integrationType === 'square' || integrationType === 'xero') {
      // Per-organization credentials - org shares one account across venues
      if (!venue) {
        return { success: false, error: `Venue required for ${integrationType} credentials lookup` }
      }
      const orgId = await getOrganizationForVenue(supabase, venue)
      if (!orgId) {
        return { success: false, error: `No organization found for venue ${venue}` }
      }
      scopeData = { venue: null, organization_id: orgId }
    } else if (integrationType === 'resend') {
      // Global credentials
      scopeData = { venue: null, organization_id: null }
    } else {
      return { success: false, error: `Unknown integration type: ${integrationType}` }
    }

    const upsertData = {
      ...scopeData,
      integration_type: integrationType,
      credentials_encrypted: encrypted,
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
      verification_status: 'pending',
    }

    // Try to update existing record first
    const coalesceVenue = scopeData.venue || ''
    const coalesceOrg = scopeData.organization_id || ''

    // Use upsert with the unique constraint
    const { error } = await supabase
      .from('venue_api_credentials')
      .upsert(upsertData, {
        onConflict: 'COALESCE(venue, \'\'), COALESCE(organization_id, \'\'), integration_type'
      })

    if (error) {
      console.error('Failed to save credentials:', error)
      return { success: false, error: String((error as { message?: string }).message || error) }
    }

    return { success: true }
  } catch (err) {
    console.error(`Error saving credentials for ${integrationType}:`, err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Update verification status for credentials
 */
export async function updateVerificationStatus(
  supabase: SupabaseClient,
  venue: string | null,
  integrationType: IntegrationType,
  status: 'pending' | 'verified' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {
      verification_status: status,
      verification_error: errorMessage || null,
      updated_at: new Date().toISOString(),
    }

    if (status === 'verified') {
      updateData.last_verified_at = new Date().toISOString()
      updateData.verification_error = null
    }

    if (integrationType === 'gmail') {
      // Per-venue credentials
      await supabase
        .from('venue_api_credentials')
        .update(updateData)
        .eq('venue', venue)
        .eq('integration_type', integrationType)
    } else if ((integrationType === 'square' || integrationType === 'xero') && venue) {
      // Per-organization credentials
      const orgId = await getOrganizationForVenue(supabase, venue)
      if (orgId) {
        await supabase
          .from('venue_api_credentials')
          .update(updateData)
          .is('venue', null)
          .eq('organization_id', orgId)
          .eq('integration_type', integrationType)
      }
    } else if (integrationType === 'resend') {
      await supabase
        .from('venue_api_credentials')
        .update(updateData)
        .is('venue', null)
        .is('organization_id', null)
        .eq('integration_type', 'resend')
    }
  } catch (err) {
    console.error(`Error updating verification status for ${integrationType}:`, err)
  }
}

/**
 * Get Square access token and location ID
 * Square access_token is per-organization (one Square account per org)
 * Square location_id is per-venue (stored in square_locations table)
 */
export async function getSquareCredentials(
  supabase: SupabaseClient,
  venue: string
): Promise<{ accessToken: string; locationId: string } | null> {
  // Get access token from org-level credentials
  const dbCreds = await getCredentials<SquareCredentials>(supabase, venue, 'square')
  let accessToken: string | null = dbCreds?.access_token || null

  // Fall back to env vars for access token
  if (!accessToken) {
    accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN') || Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN') || null
    if (accessToken) {
      console.log('Using Square access token from environment variables (fallback)')
    }
  }

  if (!accessToken) {
    return null
  }

  // Get location ID from square_locations table for this venue
  const { data: location, error } = await supabase
    .from('square_locations')
    .select('square_location_id')
    .eq('location_name', venue)
    .eq('is_active', true)
    .single()

  let locationId = (location as { square_location_id: string } | null)?.square_location_id || null

  // Fall back to env var for location ID
  if (!locationId) {
    locationId = Deno.env.get('SQUARE_LOCATION_ID') || null
    if (locationId) {
      console.log('Using Square location ID from environment variables (fallback)')
    }
  }

  if (!locationId) {
    console.warn(`No Square location found for venue: ${venue}`)
    return null
  }

  return { accessToken, locationId }
}

/**
 * Get Square access token by organization ID directly
 * Use this when you have an org ID but not a venue
 */
export async function getSquareCredentialsByOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ accessToken: string } | null> {
  try {
    const result = await supabase
      .from('venue_api_credentials')
      .select('*')
      .is('venue', null)
      .eq('organization_id', organizationId)
      .eq('integration_type', 'square')
      .single()

    const data = result.data as CredentialRow | null
    if (result.error || !data || !data.is_active) {
      // Fall back to env vars
      const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN') || Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN')
      if (accessToken) {
        console.log('Using Square credentials from environment variables (fallback)')
        return { accessToken }
      }
      return null
    }

    const encryptionKey = getEncryptionKey()
    const decrypted = await decryptToken(data.credentials_encrypted, encryptionKey)
    const creds = JSON.parse(decrypted) as SquareCredentials
    return { accessToken: creds.access_token }
  } catch (err) {
    console.error('Error fetching Square credentials by org:', err)
    // Fall back to env vars
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN') || Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN')
    if (accessToken) {
      console.log('Using Square credentials from environment variables (fallback)')
      return { accessToken }
    }
    return null
  }
}

/**
 * Map a Square location ID to a venue name
 * Location IDs are stored in square_locations table with location_name (venue)
 */
export async function getVenueForLocation(
  supabase: SupabaseClient,
  locationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('square_locations')
    .select('location_name')
    .eq('square_location_id', locationId)
    .single()

  if (error || !data) return null
  return (data as { location_name: string }).location_name
}

/**
 * Get the organization ID for a Square location
 */
export async function getOrganizationForLocation(
  supabase: SupabaseClient,
  locationId: string
): Promise<string | null> {
  const venue = await getVenueForLocation(supabase, locationId)
  if (!venue) return null
  return getOrganizationForVenue(supabase, venue)
}

/**
 * Get Resend credentials with env var fallback
 */
export async function getResendCredentials(
  supabase: SupabaseClient
): Promise<{ apiKey: string; fromEmail?: string } | null> {
  // Try DB first
  const dbCreds = await getCredentials<ResendCredentials>(supabase, null, 'resend')
  if (dbCreds) {
    return {
      apiKey: dbCreds.api_key,
      fromEmail: dbCreds.from_email,
    }
  }

  // Fall back to env vars
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (apiKey) {
    console.log('Using Resend credentials from environment variables (fallback)')
    return { apiKey }
  }

  return null
}

/**
 * Get Gmail credentials for a venue
 */
export async function getGmailCredentials(
  supabase: SupabaseClient,
  venue: string
): Promise<GmailCredentials | null> {
  return getCredentials<GmailCredentials>(supabase, venue, 'gmail')
}

/**
 * Get Xero credentials for a venue (resolves to org-level)
 */
export async function getXeroCredentials(
  supabase: SupabaseClient,
  venue: string
): Promise<XeroCredentials | null> {
  return getCredentials<XeroCredentials>(supabase, venue, 'xero')
}

/**
 * Get a valid Xero access token for a venue
 * This refreshes the token automatically since access tokens are short-lived (30 min)
 * Returns both the access token and tenant ID needed for API calls
 */
export async function getXeroAccessToken(
  supabase: SupabaseClient,
  venue: string
): Promise<{ accessToken: string; tenantId: string } | null> {
  const creds = await getXeroCredentials(supabase, venue)
  if (!creds) {
    console.log(`No Xero credentials found for venue: ${venue}`)
    return null
  }

  try {
    // Refresh the access token
    const credentials = btoa(`${creds.client_id}:${creds.client_secret}`)
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Xero token refresh failed:', response.status, errorText)
      return null
    }

    const tokenData = await response.json()

    // Update the stored refresh token if it changed (Xero rotates refresh tokens)
    if (tokenData.refresh_token && tokenData.refresh_token !== creds.refresh_token) {
      console.log('Xero refresh token rotated, updating stored credentials')
      await saveCredentials(supabase, venue, 'xero', {
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: tokenData.refresh_token,
        tenant_id: creds.tenant_id,
      })
    }

    return {
      accessToken: tokenData.access_token,
      tenantId: creds.tenant_id,
    }
  } catch (err) {
    console.error('Error refreshing Xero token:', err)
    return null
  }
}
