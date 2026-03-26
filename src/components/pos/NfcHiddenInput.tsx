import { useEffect, useRef, useState, useCallback } from 'react';
import { submitNfcUid } from '@/hooks/useNfc';

interface NfcHiddenInputProps {
  /** Whether the input should be active and capturing */
  active: boolean;
}

/**
 * Invisible input that stays focused to capture Sunmi Keyboard Wedge input.
 * Uses inputmode="none" to prevent the Android keyboard from appearing.
 */
export const NfcHiddenInput = ({ active }: NfcHiddenInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');

  // Keep focus on the hidden input at all times
  useEffect(() => {
    if (!active) return;

    const focus = () => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus({ preventScroll: true });
      }
    };

    focus();
    const interval = setInterval(focus, 300);

    // Also re-focus on any click/touch
    const refocus = () => setTimeout(focus, 50);
    document.addEventListener('click', refocus, true);
    document.addEventListener('touchend', refocus, true);

    return () => {
      clearInterval(interval);
      document.removeEventListener('click', refocus, true);
      document.removeEventListener('touchend', refocus, true);
    };
  }, [active]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputRef.current?.value || '';
      if (val.length >= 2) {
        submitNfcUid(val);
        setBuffer('');
        if (inputRef.current) inputRef.current.value = '';
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBuffer(e.target.value);
  }, []);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={buffer}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      tabIndex={-1}
    />
  );
};
