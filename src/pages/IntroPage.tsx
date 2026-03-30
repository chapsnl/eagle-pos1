import { useState, useCallback, useEffect } from 'react';

interface IntroPageProps {
  onEnter: () => void;
}

const CORRECT_PIN = '101290';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_KEY = 'pos_lockout_until';
const ATTEMPTS_KEY = 'pos_pin_attempts';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

export const IntroPage = ({ onEnter }: IntroPageProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  // Check lockout on mount
  useEffect(() => {
    const until = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
    if (until > Date.now()) {
      setLocked(true);
      setRemainingMs(until - Date.now());
    }
  }, []);

  // Countdown timer when locked
  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      const until = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
      const diff = until - Date.now();
      if (diff <= 0) {
        setLocked(false);
        setRemainingMs(0);
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
        clearInterval(interval);
      } else {
        setRemainingMs(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const handleKey = useCallback((key: string) => {
    if (locked) return;
    setError('');
    if (key === 'DEL') {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 6) {
        setTimeout(() => {
          if (newPin === CORRECT_PIN) {
            localStorage.removeItem(ATTEMPTS_KEY);
            onEnter();
          } else {
            const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
            localStorage.setItem(ATTEMPTS_KEY, String(attempts));
            if (attempts >= MAX_ATTEMPTS) {
              const until = Date.now() + LOCKOUT_MS;
              localStorage.setItem(LOCKOUT_KEY, String(until));
              setLocked(true);
              setRemainingMs(LOCKOUT_MS);
              setPin('');
              setError('');
            } else {
              setError(`Verkeerde pincode (${MAX_ATTEMPTS - attempts} pogingen over)`);
              setPin('');
            }
          }
        }, 150);
      }
    }
  }, [locked, pin, onEnter]);

  const handleSubmit = useCallback(() => {
    if (locked || pin.length !== 6) return;

    if (pin === CORRECT_PIN) {
      localStorage.removeItem(ATTEMPTS_KEY);
      onEnter();
      return;
    }

    const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));

    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      localStorage.setItem(LOCKOUT_KEY, String(until));
      setLocked(true);
      setRemainingMs(LOCKOUT_MS);
      setPin('');
      setError('');
    } else {
      setError(`Verkeerde pincode (${MAX_ATTEMPTS - attempts} pogingen over)`);
      setPin('');
    }
  }, [pin, locked, onEnter]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[hsl(220,15%,8%)] flex flex-col items-center justify-center gap-6">
      <img
        src="/placeholder.svg"
        alt="Eagle POS Logo"
        className="w-32 h-32 opacity-80"
      />
      <h1 className="text-4xl font-bold tracking-tight text-foreground font-mono">
        Eagle POS System
      </h1>

      {locked ? (
        <div className="text-center">
          <p className="text-lg font-extrabold uppercase" style={{ color: '#ef4444' }}>
            GEBLOKKEERD
          </p>
          <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>
            Probeer opnieuw over {formatTime(remainingMs)}
          </p>
        </div>
      ) : (
        <>
          {/* PIN dots */}
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2"
                style={{
                  borderColor: '#00cc13',
                  backgroundColor: i < pin.length ? '#00cc13' : 'transparent',
                  boxShadow: i < pin.length ? '0 0 8px #00cc1380' : 'none',
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{error}</p>
          )}

          {/* Numpad */}
          <div className="w-full max-w-[280px] grid grid-cols-3 gap-0">
            {NUM_KEYS.map((key, i) => (
              <button
                key={i}
                onClick={() => key && handleKey(key)}
                disabled={!key}
                className="py-4 text-2xl font-extrabold disabled:invisible"
                style={{
                  backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a',
                  color: key === 'DEL' ? '#fff' : '#e5e5e5',
                  border: '1px solid #333',
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Enter button */}
          <button
            onClick={handleSubmit}
            disabled={pin.length !== 6}
            className="text-lg font-bold px-12 py-4 rounded-md tracking-wide disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#00cc13',
              color: '#ffffff',
              boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20',
            }}
          >
            ENTER
          </button>
        </>
      )}
    </div>
  );
};
