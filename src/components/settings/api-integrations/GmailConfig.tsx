import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useVenueCredentials } from '@/hooks/useVenueCredentials';
import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/env';
import {
  Loader2,
  Mail,
  ExternalLink,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';

interface GmailConfigProps {
  venue: string;
}

export function GmailConfig({ venue }: GmailConfigProps) {
  const { status, loading, testing, testConnection, refresh } =
    useVenueCredentials(venue, 'gmail');
  const { toast } = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    const oauthUrl = `${config.supabaseUrl}/functions/v1/email-agent-oauth/start?venue=${venue}`;
    window.location.href = oauthUrl;
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      const { error } = await supabase.functions.invoke('email-agent-oauth/disconnect', {
        body: { venue },
      });

      if (error) throw error;

      toast({
        title: 'Gmail Disconnected',
        description: 'Your Gmail account has been disconnected.',
      });
      refresh();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Gmail',
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
        description: result.message || 'Gmail connection verified.',
      });
    } else {
      toast({
        title: 'Connection Failed',
        description: result.error || 'Could not connect to Gmail.',
        variant: 'destructive',
      });
    }
    return result;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Mail className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Gmail</CardTitle>
              <CardDescription>Email agent integration</CardDescription>
            </div>
          </div>
          <Badge variant={status.isConfigured ? 'default' : 'secondary'}>
            {status.isConfigured ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {status.isConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {status.isConfigured ? 'Gmail Connected' : 'Gmail Not Connected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status.isConfigured
                  ? 'OAuth tokens are securely stored'
                  : 'Connect your Gmail account to enable email agent'}
              </p>
            </div>
          </div>

          {status.isConfigured ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Test</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disconnect'
                )}
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Gmail
            </Button>
          )}
        </div>

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
          <p className="text-xs text-red-600">
            Last error: {status.verificationError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
