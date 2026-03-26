import { useCallback, useEffect, useRef } from 'react';
import { submitNfcUid } from '@/hooks/useNfc';

interface NfcHiddenInputProps {
  active: boolean;
}

export const NfcHiddenInput = ({ active }: NfcHiddenInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;

    const focusInput = () => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus({ preventScroll: true });
      }
    };

    focusInput();
    const interval = setInterval(focusInput, 250);

    const refocus = () => setTimeout(focusInput, 0);
    document.addEventListener('click', refocus, true);
    document.addEventListener('touchend', refocus, true);

    return () => {
      clearInterval(interval);
      document.removeEventListener('click', refocus, true);
      document.removeEventListener('touchend', refocus, true);
    };
  }, [active]);

  const clearInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const flushIfComplete = useCallback((raw: string) => {
    const cleaned = raw.replace(/[\r\n]+/g, '').trim();
    if (!cleaned) return;
    submitNfcUid(cleaned);
    clearInput();
  }, [clearInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    flushIfComplete(inputRef.current?.value ?? '');
  }, [flushIfComplete]);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (value.includes('\n') || value.includes('\r')) {
      flushIfComplete(value);
    }
  }, [flushIfComplete]);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="none"
      autoFocus
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onBlur={() => inputRef.current?.focus({ preventScroll: true })}
      tabIndex={0}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        zIndex: 1000,
      }}
    />
  );
};
