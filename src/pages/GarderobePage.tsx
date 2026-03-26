import { useState, useCallback } from 'react';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { FeedbackType } from '@/types/pos';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

export const GarderobePage = () => {
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [activeField, setActiveField] = useState<'coat' | 'bag' | null>(null);

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
      setter(value.slice(0, -1));
    } else {
      setter(value + key);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      <FeedbackOverlay type={feedback} />

      <h2 className="text-xl font-extrabold uppercase tracking-[0.15em]" style={{ color: '#00cc13' }}>
        Garderobe
      </h2>

      {/* Input fields */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Jasnummer (C)
          </label>
          <div
            onClick={() => setActiveField('coat')}
            className="w-full px-6 py-7 text-5xl font-extrabold text-center cursor-pointer"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              border: activeField === 'coat' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'coat' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
            }}
          >
            {coatNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Tasnummer (B)
          </label>
          <div
            onClick={() => setActiveField('bag')}
            className="w-full px-6 py-7 text-5xl font-extrabold text-center cursor-pointer"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              border: activeField === 'bag' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'bag' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
            }}
          >
            {bagNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
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

      {/* Numpad */}
      {activeField && (
        <div className="w-full max-w-md grid grid-cols-3 gap-0">
          {NUM_KEYS.map((key, i) => (
            <button
              key={i}
              onClick={() => key && handleNumKey(key)}
              disabled={!key}
              className="py-4 text-2xl font-extrabold uppercase disabled:invisible"
              style={{
                backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a',
                color: key === 'DEL' ? '#fff' : '#e5e5e5',
                border: '1px solid #333',
              }}
            >
              {key}
            </button>
          ))}
          {/* ENTER button full width */}
          <button
            onClick={handleSubmit}
            disabled={!coatNumber && !bagNumber}
            className="col-span-3 py-4 text-xl font-extrabold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#00cc13',
              color: '#fff',
              boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
              border: '1px solid #333',
            }}
          >
            SCHRIJF NFC
          </button>
        </div>
      )}
    </div>
  );
};
