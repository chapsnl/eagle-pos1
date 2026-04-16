import { useEffect, useState } from 'react';
import { pendingCount, isOnline, scheduleFlush, getPendingSessionIds } from '@/lib/offlineQueue';

/**
 * Hook to monitor offline queue status.
 * Returns pending count, online status, and set of session IDs with pending writes.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [pendingSessions, setPendingSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = async () => {
      setPending(await pendingCount());
      setPendingSessions(await getPendingSessionIds());
    };

    const handleOnline = () => { setOnline(true); update(); };
    const handleOffline = () => { setOnline(false); update(); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(update, 3000);
    update();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { pending, online, pendingSessions, flush: () => scheduleFlush(0) };
}
