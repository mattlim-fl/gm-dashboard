import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useVenueCredentials } from '@/hooks/useVenueCredentials';
import { TestConnectionButton } from './TestConnectionButton';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface SquareConfigFormProps {
  venue: string;
  onSave?: () => void;
}

export function SquareConfigForm({ venue, onSave }: SquareConfigFormProps) {
  const { status, saving, testing, saveCredentials, testConnection, refresh } =
    useVenueCredentials(venue, 'square');
  const { toast } = useToast();

  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSave = async () => {
    if (!accessToken.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Access Token is required.',
        variant: 'destructive',
      });
      return;
    }

    const result = await saveCredentials({
      access_token: accessToken.trim(),
    });

    if (result.success) {
      toast({
        title: 'Credentials Saved',
        description: 'Square access token has been saved successfully.',
      });
      setAccessToken('');
      refresh();
      onSave?.();
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
      <CardContent className="pt-6 space-y-4">
        {status.isConfigured && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400">
            Access token is saved. Enter a new value below to update it.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="square-token">Production Access Token</Label>
          <div className="relative">
            <Input
              id="square-token"
              type={showToken ? 'text' : 'password'}
              placeholder="Enter Square production access token"
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
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Location IDs are configured in the table above.
          </p>
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
              'Save Access Token'
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
