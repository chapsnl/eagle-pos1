import { useState, useEffect, useCallback } from 'react';
import { X, Delete } from 'lucide-react';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];
const CORRECT_PIN = '101290';
const ENTRY_STORAGE_KEY = 'pos_started';

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
      // Clear the started flag so user lands on IntroPage after unlock
      try {
        localStorage.removeItem(ENTRY_STORAGE_KEY);
        sessionStorage.removeItem(ENTRY_STORAGE_KEY);
      } catch {}
      setPin('');
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  }, [pin, onUnlock]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center relative">
      {/* Watermark */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
        <img
          src="/placeholder.svg"
          alt=""
          className="object-cover w-full h-full opacity-10"
        />
      </div>

      <div className="w-full max-w-sm mx-auto h-full max-h-[70vh] flex flex-col justify-center px-4 relative z-10">
        <h2
          className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2 shrink-0 relative z-10"
          style={{ color: '#00cc13' }}
        >
          PIN CODE
        </h2>

        {/* Dots display */}
        <div className="flex items-center justify-center py-2 mb-6 shrink-0 relative z-10">
          <div className="w-full flex items-center justify-center gap-4" style={{ maxWidth: '280px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2 transition-all duration-150"
                style={{
                  borderColor: error ? '#ef4444' : '#00cc13',
                  backgroundColor: i < pin.length
                    ? (error ? '#ef4444' : '#00cc13')
                    : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm mb-3 text-center shrink-0" style={{ color: '#ef4444' }}>
            Onjuiste PIN
          </p>
        )}

        {/* Numpad grid - exact copy from POS/NR */}
        <div className="grid grid-cols-3 gap-2 flex-1 min-h-0 pb-2 relative z-10">
          {NUM_KEYS.map((key, i) => (
            <button
              key={i}
              onClick={() => handleKey(key)}
              className="h-full min-h-[50px] w-full text-2xl font-extrabold uppercase flex items-center justify-center"
              style={{
                backgroundColor: key === 'DEL' ? '#ef4444' : key === 'BACK' ? '#374151' : '#2a2a2a',
                color: '#fff',
                border: '1px solid #333',
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
