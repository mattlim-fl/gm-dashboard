import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

export type IntegrationType = 'square' | 'xero' | 'gmail' | 'resend';

export interface CredentialStatus {
  id?: string;
  isConfigured: boolean;
  isActive: boolean;
  lastVerifiedAt: string | null;
  verificationStatus: 'pending' | 'verified' | 'failed' | null;
  verificationError: string | null;
  oauthExpiresAt: string | null;
}

export interface Organization {
  id: string;
  name: string;
}

export interface VenueOrganization {
  venue: string;
  organization_id: string;
  organizations?: Organization;
}

interface CredentialRow {
  id: string;
  venue: string | null;
  organization_id: string | null;
  integration_type: string;
  is_active: boolean;
  last_verified_at: string | null;
  verification_status: string | null;
  verification_error: string | null;
  oauth_expires_at: string | null;
}

export function useVenueCredentials(venue: string | null, integrationType: IntegrationType) {
  const { role } = useAuth();
  const canManageIntegrations = isAdmin(role);
  const [status, setStatus] = useState<CredentialStatus>({
    isConfigured: false,
    isActive: false,
    lastVerifiedAt: null,
    verificationStatus: null,
    verificationError: null,
    oauthExpiresAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!canManageIntegrations) {
      setStatus({
        isConfigured: false,
        isActive: false,
        lastVerifiedAt: null,
        verificationStatus: null,
        verificationError: null,
        oauthExpiresAt: null,
      });
      setLoading(false);
      return;
    }

    if (!venue && integrationType !== 'resend') {
      setStatus({
        isConfigured: false,
        isActive: false,
        lastVerifiedAt: null,
        verificationStatus: null,
        verificationError: null,
        oauthExpiresAt: null,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let data: CredentialRow | null = null;

      if (integrationType === 'gmail') {
        // Per-venue credentials - each venue has its own inbox
        const result = await supabase
          .from('venue_api_credentials')
          .select('*')
          .eq('venue', venue)
          .eq('integration_type', integrationType)
          .maybeSingle();
        data = result.data as CredentialRow | null;
      } else if (integrationType === 'square' || integrationType === 'xero') {
        // Per-organization credentials - org shares one account across venues
        const orgResult = await supabase
          .from('venue_organizations')
          .select('organization_id')
          .eq('venue', venue!)
          .single();

        if (orgResult.data) {
          const credResult = await supabase
            .from('venue_api_credentials')
            .select('*')
            .is('venue', null)
            .eq('organization_id', orgResult.data.organization_id)
            .eq('integration_type', integrationType)
            .maybeSingle();
          data = credResult.data as CredentialRow | null;
        }
      } else if (integrationType === 'resend') {
        // Global credentials
        const result = await supabase
          .from('venue_api_credentials')
          .select('*')
          .is('venue', null)
          .is('organization_id', null)
          .eq('integration_type', 'resend')
          .maybeSingle();
        data = result.data as CredentialRow | null;
      }

      setStatus({
        id: data?.id,
        isConfigured: !!data,
        isActive: data?.is_active ?? false,
        lastVerifiedAt: data?.last_verified_at ?? null,
        verificationStatus: data?.verification_status as CredentialStatus['verificationStatus'],
        verificationError: data?.verification_error ?? null,
        oauthExpiresAt: data?.oauth_expires_at ?? null,
      });
    } catch (error) {
      console.error('Error fetching credential status:', error);
    } finally {
      setLoading(false);
    }
  }, [venue, integrationType, canManageIntegrations]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const saveCredentials = async (credentials: Record<string, string>) => {
    if (!canManageIntegrations) {
      return { success: false, error: 'Admin access required' };
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.functions.invoke('save-credentials', {
        body: {
          venue,
          integrationType,
          credentials,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to save credentials');

      await fetchStatus();
      return { success: true };
    } catch (error) {
      console.error('Error saving credentials:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!canManageIntegrations) {
      return { success: false, error: 'Admin access required' };
    }

    try {
      setTesting(true);

      const { data, error } = await supabase.functions.invoke('test-credentials', {
        body: {
          venue,
          integrationType,
        },
      });

      if (error) throw error;

      // Refresh status after test
      await fetchStatus();

      return {
        success: data?.success ?? false,
        message: data?.message,
        error: data?.error,
      };
    } catch (error) {
      console.error('Error testing connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      setTesting(false);
    }
  };

  return {
    status,
    loading,
    saving,
    testing,
    refresh: fetchStatus,
    saveCredentials,
    testConnection,
  };
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [venueOrganizations, setVenueOrganizations] = useState<VenueOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [orgResult, venueOrgResult] = await Promise.all([
          supabase.from('organizations').select('*'),
          supabase.from('venue_organizations').select('*, organizations(*)'),
        ]);

        if (orgResult.data) {
          setOrganizations(orgResult.data as Organization[]);
        }
        if (venueOrgResult.data) {
          setVenueOrganizations(venueOrgResult.data as VenueOrganization[]);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  const getOrganizationForVenue = (venue: string): Organization | null => {
    const mapping = venueOrganizations.find((vo) => vo.venue === venue);
    if (!mapping) return null;
    return organizations.find((o) => o.id === mapping.organization_id) ?? null;
  };

  return {
    organizations,
    venueOrganizations,
    loading,
    getOrganizationForVenue,
  };
}
