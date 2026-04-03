import { useState, useEffect, useCallback } from 'react';
import { X, Delete } from 'lucide-react';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];
const CORRECT_PIN = '101290';

interface PinLockScreenProps {
  onUnlock: () => void;
}

const PinLockScreen = ({ onUnlock }: PinLockScreenProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = useCallback((key: string) => {
    setError(false);
    if (key === 'DEL') {
      setPin('');
      return;
    }
    if (key === 'BACK') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    setPin(prev => {
      if (prev.length >= 6) return prev;
      return prev + key;
    });
  }, []);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (pin.length !== 6) return;
    if (pin === CORRECT_PIN) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  }, [pin, onUnlock]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center min-h-screen w-full bg-black">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/placeholder.svg"
          alt=""
          className="w-full h-full object-cover opacity-10"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-xs px-4">
        <h2
          className="text-xl font-extrabold uppercase tracking-[0.15em] mb-6 text-center"
          style={{ color: '#00cc13' }}
        >
          PIN CODE
        </h2>

        {/* Dots display */}
        <div className="flex items-center justify-center gap-3 mb-6 h-14">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all duration-150"
              style={{
                borderColor: error ? '#ef4444' : '#00cc13',
                backgroundColor: i < pin.length
                  ? (error ? '#ef4444' : '#00cc13')
                  : 'transparent',
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm mb-3 text-center" style={{ color: '#ef4444' }}>
            Onjuiste PIN
          </p>
        )}

        {/* Numpad grid - identical to POS/NR */}
        <div
          className="grid grid-cols-3 gap-2 w-full"
          style={{ maxHeight: '70vh' }}
        >
          {NUM_KEYS.map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="relative z-10 flex items-center justify-center rounded-[6px] font-extrabold text-white select-none active:scale-95 transition-transform"
              style={{
                minHeight: 50,
                fontSize: '1.25rem',
                backgroundColor:
                  key === 'DEL' ? '#ef4444' : key === 'BACK' ? '#374151' : '#1f2937',
              }}
            >
              {key === 'DEL' ? <X size={22} /> : key === 'BACK' ? <Delete size={22} /> : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PinLockScreen;
