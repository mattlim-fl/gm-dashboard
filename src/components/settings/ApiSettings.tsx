import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import {
  useAllCredentials,
  type CredentialSource,
  type IntegrationStatus,
  type SquareLocation,
} from '@/hooks/useAllCredentials';
import { VENUE_LABELS, type Venue } from '@/types/venue';
import {
  SquareConfigForm,
  GmailConfigForm,
  XeroConfigForm,
  ResendConfigForm,
} from './api-integrations';
import {
  Settings2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  Mail,
  CreditCard,
  FileSpreadsheet,
  Send,
  Globe,
  Building2,
  Server,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function StatusBadge({ source }: { source: CredentialSource }) {
  if (source === 'database') {
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Configured
      </Badge>
    );
  }
  if (source === 'env') {
    return (
      <Badge variant="default" className="gap-1 bg-amber-600">
        <Server className="h-3 w-3" />
        Using env
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      Not configured
    </Badge>
  );
}

interface IntegrationRowProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  name: string;
  description: string;
  status: IntegrationStatus | null;
  locations?: SquareLocation[];
  expanded: boolean;
  onToggle: () => void;
  expandedContent: React.ReactNode;
}

function IntegrationRow({
  icon: Icon,
  iconBg,
  iconColor,
  name,
  description,
  status,
  locations,
  expanded,
  onToggle,
  expandedContent,
}: IntegrationRowProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', iconBg)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            <div>
              <p className="font-medium text-sm">{name}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge source={status?.source ?? 'none'} />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {locations && locations.length > 0 && (
          <div className="px-3 py-2 ml-12">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              <span>Locations</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {locations.map((loc) => (
                <Badge
                  key={loc.id}
                  variant={loc.is_active ? 'outline' : 'secondary'}
                  className={cn('text-xs', !loc.is_active && 'opacity-50')}
                >
                  {loc.location_name}
                  {!loc.is_active && ' (inactive)'}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2">{expandedContent}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ApiSettings = () => {
  const { role } = useAuth();
  const canManageIntegrations = isAdmin(role);
  const {
    loading,
    organizations,
    venueOrganizations,
    getIntegrationStatus,
    getSquareLocationsForOrg,
    refresh,
  } = useAllCredentials();
  const [isTransforming, setIsTransforming] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!canManageIntegrations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Integrations</CardTitle>
          <CardDescription>Admin access required.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view or change integration credentials.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const triggerTransform = async () => {
    setIsTransforming(true);
    try {
      const { data, error } = await supabase.rpc('transform_recent_synced_transactions', {
        minutes_back: 1440,
      });

      if (error) {
        alert('Transform failed: ' + error.message);
      } else {
        const message = `Transform completed successfully!

Time Window: Last ${data.minutes_back} minutes (${Math.round(data.minutes_back / 60)} hours)
Raw Payments Found: ${data.total_recent_synced}
Events Processed: ${data.processed_count}

${
  data.sample_results && data.sample_results.length > 0
    ? `Sample Event: ${data.sample_results[0].venue} - $${(data.sample_results[0].amount_cents / 100).toFixed(2)}`
    : ''
}`;
        alert(message);
      }
    } catch (error) {
      alert('Error triggering transform: ' + (error as Error).message);
    } finally {
      setIsTransforming(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Get unique organizations that have venues
  const uniqueOrgs = organizations.filter((org) =>
    venueOrganizations.some((vo) => vo.organization_id === org.id)
  );

  // Helper to get venues for an organization
  const getVenuesForOrg = (orgId: string): Venue[] => {
    return venueOrganizations
      .filter((vo) => vo.organization_id === orgId)
      .map((vo) => vo.venue);
  };

  // Helper to get source with fallback
  const getSource = (
    integrationType: 'square' | 'xero' | 'gmail' | 'resend',
    scope: 'global' | { orgId: string } | { venue: Venue }
  ): CredentialSource => {
    const integrationStatus = getIntegrationStatus(integrationType, scope);
    return integrationStatus?.source ?? 'none';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
          <Settings2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">API Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Configure API credentials for external services
          </p>
        </div>
      </div>

      {/* Global Services Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Global Services</CardTitle>
          </div>
          <CardDescription>Services used by all venues</CardDescription>
        </CardHeader>
        <CardContent>
          <IntegrationRow
            icon={Send}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            name="Resend"
            description="Email delivery for all venues"
            status={getIntegrationStatus('resend', 'global')}
            expanded={expandedSection === 'resend'}
            onToggle={() => toggleSection('resend')}
            expandedContent={<ResendConfigForm onSave={refresh} />}
          />
        </CardContent>
      </Card>

      {/* Organization Cards */}
      {uniqueOrgs.map((org) => {
        const orgVenues = getVenuesForOrg(org.id);
        const squareLocations = getSquareLocationsForOrg(org.id);
        const firstVenue = orgVenues[0];

        return (
          <Card key={org.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{org.name}</CardTitle>
              </div>
              <CardDescription>
                {orgVenues.map((v) => VENUE_LABELS[v]).join(', ')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Organization Integrations */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Organization Integrations
                </h4>
                <div className="space-y-1 ml-2 border-l-2 border-muted pl-4">
                  {/* Square */}
                  <IntegrationRow
                    icon={CreditCard}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    name="Square"
                    description="Payment processing"
                    status={getIntegrationStatus('square', { orgId: org.id })}
                    locations={squareLocations}
                    expanded={expandedSection === `square-${org.id}`}
                    onToggle={() => toggleSection(`square-${org.id}`)}
                    expandedContent={<SquareConfigForm venue={firstVenue} onSave={refresh} />}
                  />

                  {/* Xero */}
                  <IntegrationRow
                    icon={FileSpreadsheet}
                    iconBg="bg-cyan-100"
                    iconColor="text-cyan-600"
                    name="Xero"
                    description="Accounting"
                    status={getIntegrationStatus('xero', { orgId: org.id })}
                    expanded={expandedSection === `xero-${org.id}`}
                    onToggle={() => toggleSection(`xero-${org.id}`)}
                    expandedContent={<XeroConfigForm venue={firstVenue} onSave={refresh} />}
                  />
                </div>
              </div>

              {/* Venue Integrations */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Venue Integrations
                </h4>
                <div className="space-y-4 ml-2 border-l-2 border-muted pl-4">
                  {orgVenues.map((venue) => (
                    <div key={venue}>
                      <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {VENUE_LABELS[venue]}
                      </h5>
                      <div className="ml-3 border-l border-muted/50 pl-4">
                        <IntegrationRow
                          icon={Mail}
                          iconBg="bg-red-100"
                          iconColor="text-red-600"
                          name="Gmail"
                          description="Email agent"
                          status={getIntegrationStatus('gmail', { venue })}
                          expanded={expandedSection === `gmail-${venue}`}
                          onToggle={() => toggleSection(`gmail-${venue}`)}
                          expandedContent={<GmailConfigForm venue={venue} onSave={refresh} />}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Separator />

      {/* Data Transform Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data Transform</CardTitle>
          <CardDescription>Transform recently synced payments to revenue events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Transform Recent</h4>
              <p className="text-sm text-muted-foreground">Runs transform for the last 24 hours</p>
            </div>
            <Button
              onClick={triggerTransform}
              disabled={isTransforming}
              size="sm"
              variant="outline"
            >
              {isTransforming ? 'Transforming...' : 'Run Transform'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
