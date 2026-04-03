import { useState, useEffect, useCallback } from 'react';
import { X, Delete } from 'lucide-react';
import { useStaffPin } from '@/hooks/useStaffPin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];

interface PinLockScreenProps {
  onUnlock: () => void;
}

const PinLockScreen = ({ onUnlock }: PinLockScreenProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const { data: correctPin } = useStaffPin();

  const handleKey = useCallback((key: string) => {
    setError(false);
    if (key === 'DEL') { setPin(''); return; }
    if (key === 'BACK') { setPin(prev => prev.slice(0, -1)); return; }
    setPin(prev => prev.length >= 6 ? prev : prev + key);
  }, []);

  useEffect(() => {
    if (pin.length !== 6 || !correctPin) return;
    if (pin === correctPin) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  }, [pin, correctPin, onUnlock]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center w-full bg-black">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img src="/placeholder.svg" alt="" className="w-full h-full object-cover opacity-10" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
        <h2
          className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center"
          style={{ color: '#00cc13' }}
        >
          PIN CODE
        </h2>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all duration-150"
              style={{
                borderColor: error ? '#ef4444' : '#00cc13',
                backgroundColor: i < pin.length ? (error ? '#ef4444' : '#00cc13') : 'transparent',
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#ef4444' }}>
            Onjuiste PIN
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-16 w-full text-2xl font-extrabold uppercase flex items-center justify-center rounded-lg active:opacity-70"
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
      </div>
    </div>
  );
};

export default PinLockScreen;
