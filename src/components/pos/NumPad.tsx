import { X, Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];

interface NumPadProps {
  onKey: (key: string) => void;
  disabled?: boolean;
}

export const NumPad = ({ onKey, disabled }: NumPadProps) => (
  <div className="grid grid-cols-3 gap-2 flex-1 min-h-0 pb-2 relative z-10">
    {KEYS.map((key) => (
      <button
        key={key}
        onClick={() => onKey(key)}
        disabled={disabled}
        className="h-full min-h-[50px] w-full text-2xl font-extrabold uppercase flex items-center justify-center rounded-lg active:opacity-70 disabled:opacity-50"
        style={{
          backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a',
          color: '#fff',
          border: '1px solid #444',
          boxShadow: key === 'DEL' ? '0 0 10px #ef444450' : '0 0 6px #00000060',
        }}
      >
        {key === 'DEL' ? <X size={22} /> : key === 'BACK' ? <Delete size={22} /> : key}
      </button>
    ))}
  </div>
);
