import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchLastSyncTime = async (): Promise<Date | null> => {
  const { data, error } = await supabase
    .from('square_sync_status')
    .select('last_successful_sync')
    .not('last_successful_sync', 'is', null)
    .order('last_successful_sync', { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    return new Date(data[0].last_successful_sync);
  }

  return null;
};

const formatRelativeTime = (date: Date | null) => {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

export const useLastSyncTime = () => {
  const { data: lastSyncTime, isLoading } = useQuery({
    queryKey: ['last-sync-time'],
    queryFn: fetchLastSyncTime,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    lastSyncTime: lastSyncTime ?? null,
    lastSyncFormatted: formatRelativeTime(lastSyncTime ?? null),
    isLoading
  };
};
