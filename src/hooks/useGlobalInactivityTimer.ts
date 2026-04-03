import { useEffect, useRef, useCallback } from 'react';

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/**
 * Fires `onTimeout` after 5 hours of inactivity.
 * Listens on mousedown, touchstart, keydown globally.
 */
export function useGlobalInactivityTimer(enabled: boolean, onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(), FIVE_HOURS_MS);
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
