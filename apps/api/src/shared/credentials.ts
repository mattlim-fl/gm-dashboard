/**
 * Shared credentials module for Node.js backend API
 * Node.js version of supabase/functions/_shared/credentials.ts
 *
 * Handles fetching, encrypting, and saving API credentials with flexible scoping:
 * - Per-venue: Gmail (each venue has its own inbox)
 * - Per-organization: Square, Xero (org shares one account across venues)
 * - Global: Resend (single account for all)
 */

import crypto from 'crypto';
import { env } from '../env';
import type { SupabaseClient } from '@supabase/supabase-js';

// Integration types
export type IntegrationType = 'square' | 'xero' | 'gmail' | 'resend';

// Credential structures for each integration
export interface SquareCredentials {
  access_token: string;
}

export interface XeroCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  tenant_id: string;
}

export interface GmailCredentials {
  refresh_token: string;
  mailbox_email: string;
}

export interface ResendCredentials {
  api_key: string;
  from_email?: string;
}

// Union type for all credential types
export type CredentialData = SquareCredentials | XeroCredentials | GmailCredentials | ResendCredentials;

// Database row type
interface CredentialRow {
  id: string;
  venue: string | null;
  organization_id: string | null;
  integration_type: string;
  credentials_encrypted: string;
  is_active: boolean;
  last_verified_at: string | null;
  verification_status: string | null;
  verification_error: string | null;
  oauth_expires_at: string | null;
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY || env.XERO_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY or XERO_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  // If 64-char hex string, parse as hex; otherwise hash it
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decryptToken(enc: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(enc, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return plain;
}

/**
 * Get the organization ID for a venue
 */
async function getOrganizationForVenue(supabase: SupabaseClient, venue: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('venue_organizations')
    .select('organization_id')
    .eq('venue', venue)
    .single();

  if (error || !data) return null;
  return (data as { organization_id: string }).organization_id;
}

/**
 * Get credentials for a specific integration type and venue
 * Uses appropriate scoping based on integration type
 */
export async function getCredentials<T extends CredentialData>(
  supabase: SupabaseClient,
  venue: string | null,
  integrationType: IntegrationType
): Promise<T | null> {
  try {
    let data: CredentialRow | null = null;
    let error: unknown = null;

    if (integrationType === 'gmail') {
      // Per-venue credentials
      if (!venue) {
        console.warn(`getCredentials: venue required for ${integrationType}`);
        return null;
      }
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .eq('venue', venue)
        .eq('integration_type', integrationType)
        .single();
      data = result.data as CredentialRow | null;
      error = result.error;
    } else if (integrationType === 'square' || integrationType === 'xero') {
      // Per-organization credentials
      if (!venue) {
        console.warn(`getCredentials: venue required for ${integrationType} lookup`);
        return null;
      }
      const orgId = await getOrganizationForVenue(supabase, venue);
      if (!orgId) {
        console.warn(`getCredentials: no organization found for venue ${venue}`);
        return null;
      }
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .is('venue', null)
        .eq('organization_id', orgId)
        .eq('integration_type', integrationType)
        .single();
      data = result.data as CredentialRow | null;
      error = result.error;
    } else if (integrationType === 'resend') {
      // Global credentials
      const result = await supabase
        .from('venue_api_credentials')
        .select('*')
        .is('venue', null)
        .is('organization_id', null)
        .eq('integration_type', 'resend')
        .single();
      data = result.data as CredentialRow | null;
      error = result.error;
    }

    if (error || !data) {
      console.log(`No credentials found for ${integrationType} (venue: ${venue})`);
      return null;
    }

    if (!data.is_active) {
      console.log(`Credentials for ${integrationType} are inactive`);
      return null;
    }

    // Decrypt the credentials
    const decrypted = decryptToken(data.credentials_encrypted);
    return JSON.parse(decrypted) as T;
  } catch (err) {
    console.error(`Error fetching credentials for ${integrationType}:`, err);
    return null;
  }
}

/**
 * Save credentials for a specific integration type
 */
export async function saveCredentials<T extends CredentialData>(
  supabase: SupabaseClient,
  venue: string | null,
  integrationType: IntegrationType,
  credentials: T,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const encrypted = encryptToken(JSON.stringify(credentials));

    let scopeData: { venue: string | null; organization_id: string | null };

    if (integrationType === 'gmail') {
      // Per-venue credentials
      if (!venue) {
        return { success: false, error: `Venue required for ${integrationType} credentials` };
      }
      scopeData = { venue, organization_id: null };
    } else if (integrationType === 'square' || integrationType === 'xero') {
      // Per-organization credentials
      if (!venue) {
        return { success: false, error: `Venue required for ${integrationType} credentials lookup` };
      }
      const orgId = await getOrganizationForVenue(supabase, venue);
      if (!orgId) {
        return { success: false, error: `No organization found for venue ${venue}` };
      }
      scopeData = { venue: null, organization_id: orgId };
    } else if (integrationType === 'resend') {
      // Global credentials
      scopeData = { venue: null, organization_id: null };
    } else {
      return { success: false, error: `Unknown integration type: ${integrationType}` };
    }

    const upsertData = {
      ...scopeData,
      integration_type: integrationType,
      credentials_encrypted: encrypted,
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
      verification_status: 'pending',
    };

    const { error } = await supabase
      .from('venue_api_credentials')
      .upsert(upsertData, {
        onConflict: "COALESCE(venue, ''), COALESCE(organization_id, ''), integration_type"
      });

    if (error) {
      console.error('Failed to save credentials:', error);
      return { success: false, error: String((error as { message?: string }).message || error) };
    }

    return { success: true };
  } catch (err) {
    console.error(`Error saving credentials for ${integrationType}:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get Xero credentials for a venue (resolves to org-level)
 */
export async function getXeroCredentials(
  supabase: SupabaseClient,
  venue: string
): Promise<XeroCredentials | null> {
  return getCredentials<XeroCredentials>(supabase, venue, 'xero');
}

/**
 * Get a valid Xero access token for a venue
 * This refreshes the token automatically since access tokens are short-lived (30 min)
 */
export async function getXeroAccessToken(
  supabase: SupabaseClient,
  venue: string
): Promise<{ accessToken: string; tenantId: string } | null> {
  const creds = await getXeroCredentials(supabase, venue);
  if (!creds) {
    console.log(`No Xero credentials found for venue: ${venue}`);
    return null;
  }

  try {
    // Refresh the access token
    const credentials = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Xero token refresh failed:', response.status, errorText);
      return null;
    }

    const tokenData = await response.json();

    // Update the stored refresh token if it changed
    if (tokenData.refresh_token && tokenData.refresh_token !== creds.refresh_token) {
      console.log('Xero refresh token rotated, updating stored credentials');
      await saveCredentials(supabase, venue, 'xero', {
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: tokenData.refresh_token,
        tenant_id: creds.tenant_id,
      });
    }

    return {
      accessToken: tokenData.access_token,
      tenantId: creds.tenant_id,
    };
  } catch (err) {
    console.error('Error refreshing Xero token:', err);
    return null;
  }
}
