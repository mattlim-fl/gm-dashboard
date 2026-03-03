import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import type { Venue } from '@/types/venue';

export type IntegrationType = 'square' | 'xero' | 'gmail' | 'resend';
export type CredentialSource = 'database' | 'env' | 'none';

export interface CredentialRecord {
  id: string;
  venue: string | null;
  organization_id: string | null;
  integration_type: IntegrationType;
  is_active: boolean;
  last_verified_at: string | null;
  verification_status: 'pending' | 'verified' | 'failed' | null;
  verification_error: string | null;
  oauth_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface VenueOrganization {
  venue: Venue;
  organization_id: string;
  organization?: Organization;
}

export interface IntegrationStatus {
  source: CredentialSource;
  hasEnvFallback: boolean;
}

export interface CredentialsStatus {
  global: Record<string, IntegrationStatus>;
  organizations: Record<string, Record<string, IntegrationStatus>>;
  venues: Record<string, Record<string, IntegrationStatus>>;
  envVars: Record<string, boolean>;
}

export interface SquareLocation {
  id: string;
  square_location_id: string;
  location_name: string;
  venue: string | null;
  location_type: 'bar' | 'door' | 'other';
  is_active: boolean;
}

export interface AllCredentialsData {
  credentials: CredentialRecord[];
  organizations: Organization[];
  venueOrganizations: VenueOrganization[];
  squareLocations: SquareLocation[];
  status: CredentialsStatus | null;
}

export function useAllCredentials() {
  const { role } = useAuth();
  const canManageIntegrations = isAdmin(role);
  const [data, setData] = useState<AllCredentialsData>({
    credentials: [],
    organizations: [],
    venueOrganizations: [],
    squareLocations: [],
    status: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!canManageIntegrations) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [credResult, orgResult, venueOrgResult, locationsResult, statusResult] = await Promise.all([
        supabase
          .from('venue_api_credentials')
          .select('*')
          .order('integration_type', { ascending: true }),
        supabase.from('organizations').select('*'),
        supabase
          .from('venue_organizations')
          .select('venue, organization_id, organizations:organizations(id, name)'),
        supabase
          .from('square_locations')
          .select('id, square_location_id, location_name, venue, location_type, is_active')
          .order('location_name', { ascending: true }),
        supabase.functions.invoke('check-credentials-status', {
          method: 'POST',
          body: {},
        }),
      ]);

      if (credResult.error) throw credResult.error;
      if (orgResult.error) throw orgResult.error;
      if (venueOrgResult.error) throw venueOrgResult.error;
      if (locationsResult.error) throw locationsResult.error;

      // Status result might fail if function not deployed, handle gracefully
      let status: CredentialsStatus | null = null;
      if (statusResult.data?.success) {
        status = statusResult.data.status;
      } else if (statusResult.error) {
        console.warn('Failed to fetch credentials status:', statusResult.error);
      }

      setData({
        credentials: (credResult.data || []) as CredentialRecord[],
        organizations: (orgResult.data || []) as Organization[],
        venueOrganizations: (venueOrgResult.data || []).map((vo) => ({
          venue: vo.venue as Venue,
          organization_id: vo.organization_id,
          organization: vo.organizations as Organization | undefined,
        })),
        squareLocations: (locationsResult.data || []) as SquareLocation[],
        status,
      });
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch credentials');
    } finally {
      setLoading(false);
    }
  }, [canManageIntegrations]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Helper to get credential for a specific venue/integration
  const getVenueCredential = (
    venue: Venue,
    integrationType: IntegrationType
  ): CredentialRecord | null => {
    if (integrationType === 'gmail') {
      // Per-venue
      return data.credentials.find(
        (c) => c.venue === venue && c.integration_type === integrationType
      ) ?? null;
    }

    if (integrationType === 'square' || integrationType === 'xero') {
      // Per-organization
      const venueOrg = data.venueOrganizations.find((vo) => vo.venue === venue);
      if (!venueOrg) return null;
      return data.credentials.find(
        (c) =>
          c.organization_id === venueOrg.organization_id &&
          c.venue === null &&
          c.integration_type === integrationType
      ) ?? null;
    }

    return null;
  };

  // Helper to get global credential (Resend)
  const getGlobalCredential = (integrationType: IntegrationType): CredentialRecord | null => {
    return data.credentials.find(
      (c) =>
        c.venue === null &&
        c.organization_id === null &&
        c.integration_type === integrationType
    ) ?? null;
  };

  // Helper to get organization for a venue
  const getOrganizationForVenue = (venue: Venue): Organization | null => {
    const mapping = data.venueOrganizations.find((vo) => vo.venue === venue);
    return mapping?.organization ?? null;
  };

  // Get credential for an organization
  const getOrgCredential = (
    orgId: string,
    integrationType: IntegrationType
  ): CredentialRecord | null => {
    return data.credentials.find(
      (c) =>
        c.organization_id === orgId &&
        c.venue === null &&
        c.integration_type === integrationType
    ) ?? null;
  };

  // Helper to get integration status
  const getIntegrationStatus = (
    integrationType: IntegrationType,
    scope: 'global' | { orgId: string } | { venue: Venue }
  ): IntegrationStatus | null => {
    if (!data.status) return null;

    if (scope === 'global') {
      return data.status.global[integrationType] ?? null;
    }
    if ('orgId' in scope) {
      return data.status.organizations[scope.orgId]?.[integrationType] ?? null;
    }
    if ('venue' in scope) {
      return data.status.venues[scope.venue]?.[integrationType] ?? null;
    }
    return null;
  };

  // Helper to get Square locations for an organization
  const getSquareLocationsForOrg = (orgId: string): SquareLocation[] => {
    // Get all venues for this org
    const orgVenues = data.venueOrganizations
      .filter((vo) => vo.organization_id === orgId)
      .map((vo) => vo.venue);

    // Return locations where venue is in org's venues OR venue is NULL (shared locations)
    return data.squareLocations.filter(
      (loc) => loc.venue === null || orgVenues.includes(loc.venue as Venue)
    );
  };

  return {
    ...data,
    loading,
    error,
    refresh: fetchAll,
    getVenueCredential,
    getGlobalCredential,
    getOrganizationForVenue,
    getOrgCredential,
    getIntegrationStatus,
    getSquareLocationsForOrg,
    canManageIntegrations,
  };
}
