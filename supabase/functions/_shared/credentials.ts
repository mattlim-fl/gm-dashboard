/**
 * Shared credentials module for Supabase Edge Functions
 * Handles fetching, encrypting, and saving API credentials with flexible scoping:
 * - Per-venue: Square, Gmail
 * - Per-organization: Xero
 * - Global: Resend
 */

import { encryptToken, decryptToken } from './crypto.ts'
import { config } from './config.ts'

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

// Supabase client interface (minimal but comprehensive)
// deno-lint-ignore no-explicit-any
type QueryResult = Promise<{ data: any; error: any }>
// deno-lint-ignore no-explicit-any
type QueryBuilder = any

interface SupabaseClient {
  from: (table: string) => {
    select: (columns: string) => QueryBuilder
    upsert: (data: unknown, options?: { onConflict?: string }) => QueryResult
    update: (data: unknown) => QueryBuilder
    insert: (data: unknown) => QueryResult
  }
  rpc: (fn: string, params?: Record<string, unknown>) => QueryResult
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): string {
  return config.credentialsEncryptionKey
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

    // Check if record already exists - need to handle NULL values properly
    let existingId: string | null = null

    if (integrationType === 'gmail') {
      // Per-venue: match on venue + integration_type
      const { data } = await supabase
        .from('venue_api_credentials')
        .select('id')
        .eq('venue', scopeData.venue)
        .eq('integration_type', integrationType)
        .maybeSingle()
      existingId = (data as { id: string } | null)?.id || null
    } else if (integrationType === 'square' || integrationType === 'xero') {
      // Per-org: match on org_id + integration_type where venue IS NULL
      const { data } = await supabase
        .from('venue_api_credentials')
        .select('id')
        .is('venue', null)
        .eq('organization_id', scopeData.organization_id!)
        .eq('integration_type', integrationType)
        .maybeSingle()
      existingId = (data as { id: string } | null)?.id || null
    } else if (integrationType === 'resend') {
      // Global: match on integration_type where venue AND org_id are NULL
      const { data } = await supabase
        .from('venue_api_credentials')
        .select('id')
        .is('venue', null)
        .is('organization_id', null)
        .eq('integration_type', 'resend')
        .maybeSingle()
      existingId = (data as { id: string } | null)?.id || null
    }

    if (existingId) {
      // Update existing record
      const updateData = {
        credentials_encrypted: encrypted,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
        verification_status: 'pending',
      }

      const { error } = await supabase
        .from('venue_api_credentials')
        .update(updateData)
        .eq('id', existingId)

      if (error) {
        console.error('Failed to update credentials:', error)
        return { success: false, error: String((error as { message?: string }).message || error) }
      }
    } else {
      // Insert new record
      const insertData = {
        ...scopeData,
        integration_type: integrationType,
        credentials_encrypted: encrypted,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userId || null,
        updated_by: userId || null,
        verification_status: 'pending',
      }

      const { error } = await supabase
        .from('venue_api_credentials')
        .insert(insertData)

      if (error) {
        console.error('Failed to insert credentials:', error)
        return { success: false, error: String((error as { message?: string }).message || error) }
      }
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
 * Square location_id is per-venue (stored in square_locations table with venue column)
 */
export async function getSquareCredentials(
  supabase: SupabaseClient,
  venue: string
): Promise<{ accessToken: string; locationId: string } | null> {
  // Get access token from org-level credentials
  const dbCreds = await getCredentials<SquareCredentials>(supabase, venue, 'square')
  if (!dbCreds?.access_token) {
    console.warn(`No Square credentials found for venue: ${venue}`)
    return null
  }

  // Get location ID from square_locations table using venue column
  const { data: location } = await supabase
    .from('square_locations')
    .select('square_location_id')
    .eq('venue', venue)
    .eq('location_type', 'bar')  // Only get bar locations for venue lookups
    .eq('is_active', true)
    .single()

  const locationId = (location as { square_location_id: string } | null)?.square_location_id || null

  if (!locationId) {
    console.warn(`No Square location found for venue: ${venue}`)
    return null
  }

  return { accessToken: dbCreds.access_token, locationId }
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
      console.warn(`No Square credentials found for organization: ${organizationId}`)
      return null
    }

    const encryptionKey = getEncryptionKey()
    const decrypted = await decryptToken(data.credentials_encrypted, encryptionKey)
    const creds = JSON.parse(decrypted) as SquareCredentials
    return { accessToken: creds.access_token }
  } catch (err) {
    console.error('Error fetching Square credentials by org:', err)
    return null
  }
}

/**
 * Map a Square location ID to a venue name
 * Returns the venue code (manor, hippie, daisy) or NULL for shared locations (door)
 */
export async function getVenueForLocation(
  supabase: SupabaseClient,
  locationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('square_locations')
    .select('venue, location_type')
    .eq('square_location_id', locationId)
    .single()

  if (error || !data) return null
  const location = data as { venue: string | null; location_type: string }
  // Return venue if set, otherwise return location_type for shared locations (e.g., "door")
  return location.venue || location.location_type
}

/**
 * Get location details by Square location ID
 * Returns full location info including venue, type, and display name
 */
export async function getLocationDetails(
  supabase: SupabaseClient,
  locationId: string
): Promise<{ venue: string | null; locationType: string; locationName: string } | null> {
  const { data, error } = await supabase
    .from('square_locations')
    .select('venue, location_type, location_name')
    .eq('square_location_id', locationId)
    .single()

  if (error || !data) return null
  const location = data as { venue: string | null; location_type: string; location_name: string }
  return {
    venue: location.venue,
    locationType: location.location_type,
    locationName: location.location_name,
  }
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
 * Get Resend credentials from database
 */
export async function getResendCredentials(
  supabase: SupabaseClient
): Promise<{ apiKey: string; fromEmail?: string } | null> {
  const dbCreds = await getCredentials<ResendCredentials>(supabase, null, 'resend')
  if (!dbCreds) {
    console.warn('No Resend credentials found in database')
    return null
  }
  return {
    apiKey: dbCreds.api_key,
    fromEmail: dbCreds.from_email,
  }
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
 * Get the credential ID for a venue + integration type
 */
async function getCredentialId(
  supabase: SupabaseClient,
  venue: string,
  integrationType: IntegrationType
): Promise<string | null> {
  if (integrationType === 'xero' || integrationType === 'square') {
    const orgId = await getOrganizationForVenue(supabase, venue)
    if (!orgId) return null

    const { data } = await supabase
      .from('venue_api_credentials')
      .select('id')
      .is('venue', null)
      .eq('organization_id', orgId)
      .eq('integration_type', integrationType)
      .single()

    return (data as { id: string } | null)?.id || null
  }
  return null
}

/**
 * Get cached access token from oauth_token_cache
 */
async function getCachedAccessToken(
  supabase: SupabaseClient,
  credentialId: string
): Promise<{ access_token: string; expires_at: string } | null> {
  const { data, error } = await supabase
    .from('oauth_token_cache')
    .select('access_token_encrypted, expires_at')
    .eq('credential_id', credentialId)
    .single()

  if (error || !data) return null

  const row = data as { access_token_encrypted: string; expires_at: string }
  if (!row.access_token_encrypted) {
    return null // Empty placeholder row from lock acquisition
  }
  try {
    const encryptionKey = getEncryptionKey()
    const accessToken = await decryptToken(row.access_token_encrypted, encryptionKey)
    return { access_token: accessToken, expires_at: row.expires_at }
  } catch {
    console.error('Failed to decrypt cached access token')
    return null
  }
}

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Refresh Xero token with optimistic locking to prevent race conditions.
 * Uses atomic lock acquisition to ensure only one request refreshes at a time.
 */
async function refreshXeroTokenWithLock(
  supabase: SupabaseClient,
  venue: string,
  credentialId: string,
  creds: XeroCredentials,
  retryCount = 0
): Promise<{ accessToken: string; tenantId: string } | null> {
  const MAX_RETRIES = 3
  if (retryCount >= MAX_RETRIES) {
    console.error(`Xero token refresh exceeded max retries (${MAX_RETRIES})`)
    return null
  }

  const now = new Date()
  const lockUntil = new Date(now.getTime() + 30000) // 30 second lock

  // Atomically: ensure cache row exists + acquire lock if free/expired
  const { data: lockAcquired, error: rpcError } = await supabase
    .rpc('acquire_refresh_lock', {
      p_credential_id: credentialId,
      p_lock_until: lockUntil.toISOString(),
    })

  if (rpcError) {
    console.error('Lock acquisition RPC error:', rpcError)
    return null
  }

  if (!lockAcquired) {
    // Another request has the lock — wait and check cache
    console.log('Xero token refresh locked by another request, waiting...')
    await sleep(2000)
    return getXeroAccessToken(supabase, venue, retryCount + 1)
  }

  try {
    // We have the lock - do the refresh
    console.log('Refreshing Xero access token...')
    const clientId = config.xeroClientId
    const clientSecret = config.xeroClientSecret
    if (!clientId || !clientSecret) {
      console.error('Xero client credentials not configured in environment')
      return null
    }
    const credentials = btoa(`${clientId}:${clientSecret}`)
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

      // Release lock on failure
      await supabase
        .from('oauth_token_cache')
        .update({ refresh_lock_until: null })
        .eq('credential_id', credentialId)

      // If invalid_grant, another request may have already rotated the token
      if (response.status === 400 && errorText.includes('invalid_grant')) {
        console.log('Got invalid_grant — checking if another request already refreshed')
        await sleep(500)
        const freshCached = await getCachedAccessToken(supabase, credentialId)
        if (freshCached) {
          const freshExpiry = new Date(freshCached.expires_at)
          if (freshExpiry.getTime() > Date.now() + 60000) {
            console.log('Found fresh cached token from another request')
            return { accessToken: freshCached.access_token, tenantId: creds.tenant_id }
          }
        }
      }

      return null
    }

    const tokenData = await response.json()

    // Calculate expiry (Xero tokens are typically 30 minutes)
    const expiresInMs = (tokenData.expires_in || 1800) * 1000
    const expiresAt = new Date(Date.now() + expiresInMs).toISOString()

    // Save access token to cache and release lock
    const encryptionKey = getEncryptionKey()
    const encryptedToken = await encryptToken(tokenData.access_token, encryptionKey)
    await supabase
      .from('oauth_token_cache')
      .upsert({
        credential_id: credentialId,
        access_token_encrypted: encryptedToken,
        expires_at: expiresAt,
        refresh_lock_until: null, // Release lock
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'credential_id'
      })

    // Update refresh token if it was rotated
    if (tokenData.refresh_token && tokenData.refresh_token !== creds.refresh_token) {
      console.log('Xero refresh token rotated, updating stored credentials')
      await saveCredentials(supabase, venue, 'xero', {
        refresh_token: tokenData.refresh_token,
        tenant_id: creds.tenant_id,
      })
    }

    console.log('Xero token refreshed and cached successfully')
    return {
      accessToken: tokenData.access_token,
      tenantId: creds.tenant_id,
    }
  } catch (err) {
    console.error('Error refreshing Xero token:', err)
    // Release lock on error
    await supabase
      .from('oauth_token_cache')
      .update({ refresh_lock_until: null })
      .eq('credential_id', credentialId)
    return null
  }
}

/**
 * Get a valid Xero access token for a venue
 * Uses caching and database-level locking to prevent race conditions when
 * multiple concurrent requests try to refresh tokens.
 *
 * Xero refresh tokens are single-use - each refresh returns a NEW refresh token
 * and invalidates the old one. Without caching, concurrent requests would all
 * try to refresh with the same (now invalid) refresh token.
 */
export async function getXeroAccessToken(
  supabase: SupabaseClient,
  venue: string,
  retryCount = 0
): Promise<{ accessToken: string; tenantId: string } | null> {
  const creds = await getXeroCredentials(supabase, venue)
  if (!creds) {
    console.log(`No Xero credentials found for venue: ${venue}`)
    return null
  }

  // Get the credential ID for cache lookup
  const credentialId = await getCredentialId(supabase, venue, 'xero')
  if (!credentialId) {
    console.log(`No credential ID found for Xero (venue: ${venue})`)
    return null
  }

  // Check for cached, non-expired access token
  const cached = await getCachedAccessToken(supabase, credentialId)
  if (cached) {
    const expiresAt = new Date(cached.expires_at)
    const bufferTime = 60000 // 1 minute buffer

    if (expiresAt.getTime() > Date.now() + bufferTime) {
      // Token is still valid (with buffer)
      console.log('Using cached Xero access token')
      return {
        accessToken: cached.access_token,
        tenantId: creds.tenant_id,
      }
    }
  }

  // Token expired or not cached - refresh with locking
  return refreshXeroTokenWithLock(supabase, venue, credentialId, creds, retryCount)
}
