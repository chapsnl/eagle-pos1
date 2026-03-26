import { useState, useCallback } from 'react';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { FeedbackType } from '@/types/pos';

export const GarderobePage = () => {
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);

  const handleSubmit = useCallback(() => {
    if (!coatNumber && !bagNumber) return;
    
    const code = `${coatNumber ? 'C' + coatNumber : ''}${bagNumber ? 'B' + bagNumber : ''}`;
    console.log('Garderobe code:', code);
    
    // Simulate NFC write success
    setFeedback('success');
    setTimeout(() => {
      setFeedback(null);
      setCoatNumber('');
      setBagNumber('');
    }, 2000);
  }, [coatNumber, bagNumber]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <FeedbackOverlay type={feedback} />
      
      <h2 className="text-2xl font-extrabold uppercase tracking-[0.15em] text-primary">
        Garderobe
      </h2>
      <p className="text-muted-foreground text-sm text-center max-w-sm">
        Voer jas- en/of tasnummer in. Scan daarna het NFC-bandje om te schrijven.
      </p>

      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Jasnummer (C)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={coatNumber}
            onChange={(e) => setCoatNumber(e.target.value)}
            placeholder="102"
            className="w-full bg-secondary text-foreground border border-border rounded-lg px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
            Tasnummer (B)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={bagNumber}
            onChange={(e) => setBagNumber(e.target.value)}
            placeholder="203"
            className="w-full bg-secondary text-foreground border border-border rounded-lg px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!coatNumber && !bagNumber}
        className="pos-btn bg-primary text-primary-foreground rounded-lg px-8 py-4 text-lg w-full max-w-xs disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
      >
        SCHRIJF NFC
      </button>

      {(coatNumber || bagNumber) && (
        <div className="text-center">
          <span className="text-xs text-muted-foreground">Preview: </span>
          <span className="text-sm font-extrabold text-primary">
            {coatNumber ? 'C' + coatNumber : ''}{bagNumber ? 'B' + bagNumber : ''}
          </span>
        </div>
      )}
    </div>
  );
};
