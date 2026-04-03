import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NumPad } from '@/components/pos/NumPad';

interface PinLockScreenProps {
  onUnlock: () => void;
}

const PinLockScreen = ({ onUnlock }: PinLockScreenProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleKey = useCallback((key: string) => {
    if (checking) return;
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
  }, [checking]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (pin.length !== 6) return;
    setChecking(true);
    supabase.functions.invoke('verify-pin', {
      body: { pin, type: 'staff' },
    }).then(({ data, error: fnError }) => {
      if (!fnError && data?.valid) {
        onUnlock();
      } else {
        setError(true);
        setPin('');
      }
      setChecking(false);
    });
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

        {/* Numpad grid */}
        <NumPad onKey={handleKey} disabled={checking} />
      </div>
    </div>
  );
};

export default PinLockScreen;
