import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface ShareableLinksProps {
  organiserUrl: string;
  shareUrl: string;
}

export function ShareableLinks({ organiserUrl, shareUrl }: ShareableLinksProps) {
  const [copiedOrganiser, setCopiedOrganiser] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const copyToClipboard = (text: string, type: 'organiser' | 'share') => {
    navigator.clipboard.writeText(text);
    if (type === 'organiser') {
      setCopiedOrganiser(true);
      setTimeout(() => setCopiedOrganiser(false), 2000);
    } else {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="font-semibold dark:text-white">Shareable Links</h3>

        {/* Organiser Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Organiser Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={organiserUrl}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(organiserUrl, 'organiser')}
            >
              {copiedOrganiser ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(organiserUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Share this with the organiser to manage their guest list
          </p>
        </div>

        {/* Share Link for Friends */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Friend Purchase Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(shareUrl, 'share')}
            >
              {copiedShare ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(shareUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Share this link so friends can purchase tickets
          </p>
        </div>
      </div>
    </>
  );
}
