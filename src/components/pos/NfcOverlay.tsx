import { Nfc } from 'lucide-react';

interface NfcOverlayProps {
  status: 'scanning' | 'writing' | null;
  onCancel: () => void;
}

export const NfcOverlay = ({ status, onCancel }: NfcOverlayProps) => {
  if (!status) return null;

  const isWriting = status === 'writing';

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <span
        className="text-2xl font-extrabold uppercase tracking-[0.2em] animate-[nfcPulse_3s_ease-in-out_infinite]"
        style={{ color: '#00cc13' }}
      >
        {isWriting ? 'Schrijven...' : 'Scan NFC'}
      </span>
      <Nfc
        className="w-32 h-32 mt-4 animate-[nfcPulse_3s_ease-in-out_infinite]"
        style={{ color: '#00cc13', filter: 'drop-shadow(0 0 20px #00cc1360)' }}
      />
      <button
        onClick={onCancel}
        className="mt-8 px-8 py-3 font-extrabold uppercase text-sm"
        style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 16px #ef444480' }}
      >
        CANCEL
      </button>
    </div>
  );
};
