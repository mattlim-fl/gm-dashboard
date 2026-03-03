import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useVenueCredentials } from '@/hooks/useVenueCredentials';
import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/env';
import { Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface XeroConfigFormProps {
  venue: string;
  onSave?: () => void;
}

export function XeroConfigForm({ venue, onSave }: XeroConfigFormProps) {
  const { status, testing, testConnection, refresh } = useVenueCredentials(venue, 'xero');
  const { toast } = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    const oauthUrl = `${config.supabaseUrl}/functions/v1/xero-oauth/start?venue=${venue}`;
    window.location.href = oauthUrl;
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      const { error } = await supabase.functions.invoke('xero-oauth/disconnect', {
        body: { venue },
      });

      if (error) throw error;

      toast({
        title: 'Xero Disconnected',
        description: 'Your Xero account has been disconnected.',
      });
      refresh();
      onSave?.();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Xero',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTest = async () => {
    const result = await testConnection();
    if (result.success) {
      toast({
        title: 'Connection Successful',
        description: result.message || 'Xero connection verified.',
      });
    } else {
      toast({
        title: 'Connection Failed',
        description: result.error || 'Could not connect to Xero.',
        variant: 'destructive',
      });
    }
    return result;
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {status.isConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {status.isConfigured ? 'Xero Connected' : 'Xero Not Connected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status.isConfigured
                  ? 'OAuth tokens are securely stored'
                  : 'Connect your Xero account for financial reporting'}
              </p>
            </div>
          </div>

          {status.isConfigured ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Test</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Xero
            </Button>
          )}
        </div>

        {status.oauthExpiresAt && (
          <p className="text-xs text-muted-foreground">
            Token expires:{' '}
            {new Date(status.oauthExpiresAt).toLocaleString('en-AU', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        )}

        {status.lastVerifiedAt && (
          <p className="text-xs text-muted-foreground">
            Last verified:{' '}
            {new Date(status.lastVerifiedAt).toLocaleString('en-AU', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        )}

        {status.verificationError && (
          <p className="text-xs text-red-600">Last error: {status.verificationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
