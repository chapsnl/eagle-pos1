import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 20_000; // 20 seconds

/**
 * Fires `onTimeout` after 20s of inactivity (no mousedown/touchstart/keydown).
 * Only active when `enabled` is true. Cleans up on unmount or when disabled.
 */
export function useInactivityTimer(enabled: boolean, onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(), INACTIVITY_TIMEOUT);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    resetTimer();

    const handler = () => resetTimer();
    window.addEventListener('mousedown', handler, true);
    window.addEventListener('touchstart', handler, true);
    window.addEventListener('keydown', handler, true);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('mousedown', handler, true);
      window.removeEventListener('touchstart', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
  }, [enabled, resetTimer]);
}
