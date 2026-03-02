import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import {
  VenueCredentialSelector,
  SquareConfig,
  GmailConfig,
  XeroConfig,
  ResendConfig,
} from './api-integrations';
import { Settings2 } from 'lucide-react';

export const ApiSettings = () => {
  const { role } = useAuth();
  const canManageIntegrations = isAdmin(role);
  const [selectedVenue, setSelectedVenue] = useState('manor');
  const [isTransforming, setIsTransforming] = useState(false);

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

  const triggerTransform = async () => {
    setIsTransforming(true);
    try {
      const { data, error } = await supabase.rpc('transform_recent_synced_transactions', {
        minutes_back: 1440
      });

      if (error) {
        alert('Transform failed: ' + error.message);
      } else {
        const message = `Transform completed successfully!

Time Window: Last ${data.minutes_back} minutes (${Math.round(data.minutes_back / 60)} hours)
Raw Payments Found: ${data.total_recent_synced}
Events Processed: ${data.processed_count}

${data.sample_results && data.sample_results.length > 0 ?
  `Sample Event: ${data.sample_results[0].venue} - $${(data.sample_results[0].amount_cents / 100).toFixed(2)}` : ''}`;
        alert(message);
      }
    } catch (error) {
      alert('Error triggering transform: ' + (error as Error).message);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* API Integrations Section */}
      <div className="space-y-6">
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

        <VenueCredentialSelector value={selectedVenue} onChange={setSelectedVenue} />

        {/* Per-Venue Credentials */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Per-Venue Credentials
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <GmailConfig venue={selectedVenue} />
          </div>
        </div>

        {/* Organization Credentials */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Organization Credentials
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SquareConfig venue={selectedVenue} />
            <XeroConfig venue={selectedVenue} />
          </div>
        </div>

        {/* Global Credentials */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Global Credentials
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ResendConfig />
          </div>
        </div>
      </div>

      <Separator />

      {/* Data Transform Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data Transform</CardTitle>
          <CardDescription>
            Transform recently synced payments to revenue events
          </CardDescription>
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
