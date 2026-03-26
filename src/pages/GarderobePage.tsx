import { useState, useCallback, useEffect } from 'react';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { FeedbackType } from '@/types/pos';
import { Send } from 'lucide-react';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

export const GarderobePage = () => {
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [activeField, setActiveField] = useState<'coat' | 'bag' | null>(null);

  // Auto-close numpad when 3 digits entered
  useEffect(() => {
    if (activeField === 'coat' && coatNumber.length >= 3) setActiveField(null);
    if (activeField === 'bag' && bagNumber.length >= 3) setActiveField(null);
  }, [coatNumber, bagNumber, activeField]);

  const handleSubmit = useCallback(() => {
    if (!coatNumber && !bagNumber) return;
    const code = `${coatNumber ? 'C' + coatNumber : ''}${bagNumber ? 'B' + bagNumber : ''}`;
    console.log('Garderobe code:', code);
    setFeedback('success');
    setTimeout(() => {
      setFeedback(null);
      setCoatNumber('');
      setBagNumber('');
      setActiveField(null);
    }, 2000);
  }, [coatNumber, bagNumber]);

  const handleNumKey = (key: string) => {
    if (!activeField) return;
    const setter = activeField === 'coat' ? setCoatNumber : setBagNumber;
    const value = activeField === 'coat' ? coatNumber : bagNumber;
    if (key === 'DEL') {
      setter('');
    } else if (value.length < 3) {
      setter(value + key);
    }
  };

  const showNumpad = activeField !== null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <FeedbackOverlay type={feedback} />

      <h2 className="font-extrabold uppercase tracking-[0.15em] text-center pt-3 pb-2" style={{ color: '#00cc13', fontSize: '29px' }}>
        Garderobe
      </h2>

      {/* Fields area - grows to fill available space */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <div className="w-full" style={{ maxWidth: '280px' }}>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Jasnummer (C)
          </label>
          <div
            onClick={() => setActiveField('coat')}
            className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              fontSize: showNumpad ? 'clamp(40px, 8vw, 64px)' : 'clamp(56px, 12vw, 96px)',
              padding: showNumpad ? 'clamp(12px, 2vh, 20px) 16px' : 'clamp(24px, 5vh, 48px) 16px',
              border: activeField === 'coat' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'coat' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {coatNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>
        <div className="w-full" style={{ maxWidth: '280px' }}>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Tasnummer (B)
          </label>
          <div
            onClick={() => setActiveField('bag')}
            className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              fontSize: showNumpad ? 'clamp(40px, 8vw, 64px)' : 'clamp(56px, 12vw, 96px)',
              padding: showNumpad ? 'clamp(12px, 2vh, 20px) 16px' : 'clamp(24px, 5vh, 48px) 16px',
              border: activeField === 'bag' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'bag' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {bagNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>

        {/* Preview */}
        {(coatNumber || bagNumber) && (
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Preview: </span>
            <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
              {coatNumber ? 'C' + coatNumber : ''}{bagNumber ? 'B' + bagNumber : ''}
            </span>
          </div>
        )}
      </div>

      {/* Numpad */}
      {showNumpad && (
        <div className="px-4 pb-2">
          <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-0">
            {NUM_KEYS.map((key, i) => (
              <button
                key={i}
                onClick={() => key && handleNumKey(key)}
                disabled={!key}
                className="py-3 text-2xl font-extrabold uppercase disabled:invisible"
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
        </div>
      )}

      {/* SEND button - always at bottom */}
      <div className="px-4 pb-3 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!coatNumber && !bagNumber}
          className="w-full py-4 text-xl font-extrabold uppercase disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{
            backgroundColor: '#00cc13',
            color: '#fff',
            boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
          }}
        >
          <Send className="w-6 h-6" />
          SEND
        </button>
      </div>
    </div>
  );
};
