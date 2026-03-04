import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useVenueCredentials } from '@/hooks/useVenueCredentials';
import { TestConnectionButton } from './TestConnectionButton';
import { Loader2, CreditCard, Eye, EyeOff } from 'lucide-react';

interface SquareConfigProps {
  venue: string;
}

export function SquareConfig({ venue }: SquareConfigProps) {
  const { status, loading, saving, testing, saveCredentials, testConnection, refresh } =
    useVenueCredentials(venue, 'square');
  const { toast } = useToast();

  const [accessToken, setAccessToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSave = async () => {
    if (!accessToken.trim() || !locationId.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Both Access Token and Location ID are required.',
        variant: 'destructive',
      });
      return;
    }

    const result = await saveCredentials({
      access_token: accessToken.trim(),
      location_id: locationId.trim(),
    });

    if (result.success) {
      toast({
        title: 'Credentials Saved',
        description: 'Square credentials have been saved successfully.',
      });
      setAccessToken('');
      setLocationId('');
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
        description: result.message || 'Square API connection verified.',
      });
    } else {
      toast({
        title: 'Connection Failed',
        description: result.error || 'Could not connect to Square.',
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
            <div className="p-2 rounded-lg bg-blue-100">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Square</CardTitle>
              <CardDescription>Payment processing</CardDescription>
            </div>
          </div>
          <Badge variant={status.isConfigured ? 'default' : 'secondary'}>
            {status.isConfigured ? 'Configured' : 'Not configured'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isConfigured && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            Credentials are saved. Enter new values below to update them.
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="square-token">Access Token</Label>
            <div className="relative">
              <Input
                id="square-token"
                type={showToken ? 'text' : 'password'}
                placeholder="Enter Square access token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="square-location">Location ID</Label>
            <Input
              id="square-location"
              type="text"
              placeholder="Enter Square location ID"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            />
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
