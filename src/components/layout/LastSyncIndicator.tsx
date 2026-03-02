import React, { useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSidebar } from '@/components/ui/sidebar';
import { config } from '@/config/env';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface LastSyncIndicatorProps {
  lastSyncTime?: string;
  onSyncComplete?: () => void;
}

interface SyncResult {
  payments?: { upserted?: number };
  orders?: { upserted?: number };
}

export const LastSyncIndicator: React.FC<LastSyncIndicatorProps> = ({ lastSyncTime, onSyncComplete }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { state } = useSidebar();

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const API_BASE = config.apiBaseUrl;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be signed in to trigger a sync.');
        return;
      }
      // Sync will intelligently resume from last successful sync using square_location_sync_status
      const res = await fetch(`${API_BASE}/square/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          overlap_minutes: 5, // Overlap for safety (default)
          max_lookback_days: 30, // Fallback if no previous sync exists
          dry_run: false 
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const stage = json?.stage ? ` (${json.stage})` : '';
        const errorMsg = json?.error || res.statusText || 'Unknown error';
        alert(`Sync failed${stage}: ${errorMsg}`);
        return;
      }
      
      // Show summary if available
      const results: SyncResult[] = json?.results || [];
      if (results.length > 0) {
        const totalPayments = results.reduce((sum: number, r: SyncResult) => 
          sum + (r.payments?.upserted || 0), 0);
        const totalOrders = results.reduce((sum: number, r: SyncResult) => 
          sum + (r.orders?.upserted || 0), 0);
        alert(`Sync completed successfully!\n\nLocations: ${results.length}\nPayments: ${totalPayments}\nOrders: ${totalOrders}`);
      } else {
        alert('Sync completed successfully!');
      }
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      alert('Error triggering sync: ' + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const syncTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const syncButton = (
    <Button
      variant="ghost"
      size={state === "collapsed" ? "icon" : "sm"}
      onClick={triggerSync}
      disabled={isSyncing}
      className={state === "collapsed" ? "h-8 w-8 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" : "h-6 w-6 p-0"}
      title="Sync & Transform"
    >
      <RotateCcw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
    </Button>
  );

  if (state === "collapsed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {syncButton}
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <div className="flex flex-col gap-1">
            <span>Last synced: {lastSyncTime ? formatTimeAgo(lastSyncTime) : 'never'}</span>
            <span className="text-xs text-muted-foreground">Click to sync</span>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Last synced: {lastSyncTime ? formatTimeAgo(lastSyncTime) : 'never'}</span>
      {syncButton}
    </div>
  );
};