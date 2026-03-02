import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface TestConnectionButtonProps {
  onTest: () => Promise<{ success: boolean; message?: string; error?: string }>;
  disabled?: boolean;
  testing?: boolean;
  lastStatus?: 'verified' | 'failed' | 'pending' | null;
}

export function TestConnectionButton({
  onTest,
  disabled,
  testing,
  lastStatus,
}: TestConnectionButtonProps) {
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const handleTest = async () => {
    setResult(null);
    const response = await onTest();
    setResult({
      success: response.success,
      message: response.success ? response.message : response.error,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={disabled || testing}
      >
        {testing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Test Connection
          </>
        )}
      </Button>

      {result && (
        <div className="flex items-center gap-1 text-sm">
          {result.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-green-700">{result.message || 'Connected'}</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700">{result.message || 'Failed'}</span>
            </>
          )}
        </div>
      )}

      {!result && lastStatus && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {lastStatus === 'verified' && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Verified</span>
            </>
          )}
          {lastStatus === 'failed' && (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Failed</span>
            </>
          )}
          {lastStatus === 'pending' && (
            <span className="text-muted-foreground">Not verified</span>
          )}
        </div>
      )}
    </div>
  );
}
