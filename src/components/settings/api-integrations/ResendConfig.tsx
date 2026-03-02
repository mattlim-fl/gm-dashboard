import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useVenueCredentials } from '@/hooks/useVenueCredentials';
import { TestConnectionButton } from './TestConnectionButton';
import { Loader2, Send, Eye, EyeOff, Globe } from 'lucide-react';

export function ResendConfig() {
  const { status, loading, saving, testing, saveCredentials, testConnection, refresh } =
    useVenueCredentials(null, 'resend');
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Validation Error',
        description: 'API Key is required.',
        variant: 'destructive',
      });
      return;
    }

    const credentials: Record<string, string> = {
      api_key: apiKey.trim(),
    };
    if (fromEmail.trim()) {
      credentials.from_email = fromEmail.trim();
    }

    const result = await saveCredentials(credentials);

    if (result.success) {
      toast({
        title: 'Credentials Saved',
        description: 'Resend credentials have been saved successfully.',
      });
      setApiKey('');
      setFromEmail('');
      refresh();
    } else {
      toast({
        title: 'Save Failed',
        description: result.error || 'Failed to save credentials.',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    const result = await testConnection();
    if (result.success) {
      toast({
        title: 'Connection Successful',
        description: result.message || 'Resend API connection verified.',
      });
    } else {
      toast({
        title: 'Connection Failed',
        description: result.error || 'Could not connect to Resend.',
        variant: 'destructive',
      });
    }
    return result;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Send className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Resend</CardTitle>
              <CardDescription>Email delivery service</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              Global
            </Badge>
            <Badge variant={status.isConfigured ? 'default' : 'secondary'}>
              {status.isConfigured ? 'Configured' : 'Not configured'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          Resend is a global setting shared across all venues.
        </div>

        {status.isConfigured && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            Credentials are saved. Enter new values below to update them.
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resend-key">API Key</Label>
            <div className="relative">
              <Input
                id="resend-key"
                type={showKey ? 'text' : 'password'}
                placeholder="Enter Resend API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-from">From Email (optional)</Label>
            <Input
              id="resend-from"
              type="email"
              placeholder="noreply@yourdomain.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default sender email address. Leave blank to use Resend's default.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <TestConnectionButton
            onTest={handleTest}
            disabled={!status.isConfigured}
            testing={testing}
            lastStatus={status.verificationStatus}
          />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Credentials'
            )}
          </Button>
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
      </CardContent>
    </Card>
  );
}
