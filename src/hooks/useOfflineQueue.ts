import { useEffect, useState } from 'react';
import { pendingCount, isOnline, scheduleFlush } from '@/lib/offlineQueue';

/**
 * Hook to monitor offline queue status.
 * Returns pending count and online status for optional UI indicators.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const updatePending = async () => {
      setPending(await pendingCount());
    };

    const handleOnline = () => { setOnline(true); updatePending(); };
    const handleOffline = () => { setOnline(false); updatePending(); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll pending count every 3s
    const interval = setInterval(updatePending, 3000);
    updatePending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { pending, online, flush: () => scheduleFlush(0) };
}
