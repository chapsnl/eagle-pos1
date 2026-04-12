import { X, Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];

interface NumPadProps {
  onKey: (key: string) => void;
  disabled?: boolean;
}

export const NumPad = ({ onKey, disabled }: NumPadProps) => (
  <div className="grid grid-cols-3 gap-3 w-full relative z-10">
    {KEYS.map((key) => (
      <button
        key={key}
        onClick={() => onKey(key)}
        disabled={disabled}
        className="h-16 w-full text-2xl font-extrabold uppercase flex items-center justify-center rounded-lg active:opacity-70 disabled:opacity-50"
        style={{
          backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a',
          color: '#fff',
          border: '1px solid #444',
          boxShadow: key === 'DEL' ? '0 0 10px #ef444450' : '0 0 6px #00000060',
        }}
      >
        {key === 'DEL' ? <X className="w-6 h-6" /> : key === 'BACK' ? <Delete className="w-6 h-6" /> : key}
      </button>
    ))}
  </div>
);
