import { useEffect, useRef } from 'react';
import { Nfc, X } from 'lucide-react';

interface NfcOverlayProps {
  status: 'scanning' | null;
  onCancel: () => void;
}

export const NfcOverlay = ({ status, onCancel }: NfcOverlayProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the hidden input focused so Sunmi keyboard emulation has a target
  useEffect(() => {
    if (!status) return;

    const focus = () => inputRef.current?.focus();
    focus();

    // Re-focus every 500ms in case something steals focus
    const interval = setInterval(focus, 500);
    return () => clearInterval(interval);
  }, [status]);

  if (!status) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Hidden input for Sunmi keyboard emulation */}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        className="absolute opacity-0 w-0 h-0"
        style={{ position: 'absolute', left: '-9999px' }}
        tabIndex={-1}
        onKeyDown={(e) => e.preventDefault()}
        readOnly
      />
      <Nfc
        className="w-32 h-32 animate-[nfcPulse_3s_ease-in-out_infinite]"
        style={{ color: '#00cc13', filter: 'drop-shadow(0 0 20px #00cc1360)' }}
      />
      <span
        className="mt-6 text-2xl font-extrabold uppercase tracking-[0.2em] animate-[nfcPulse_3s_ease-in-out_infinite]"
        style={{ color: '#00cc13' }}
      >
        Houd bandje tegen scanner...
      </span>
      <button
        onClick={onCancel}
        className="mt-8 flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-bold uppercase text-sm rounded"
      >
        <X className="w-4 h-4" /> ANNULEREN
      </button>
    </div>
  );
};
