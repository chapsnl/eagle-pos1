import { useState, useCallback, useEffect } from 'react';
import { OrderItem } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { FeedbackType } from '@/types/pos';
import { X, CreditCard, Banknote, Send } from 'lucide-react';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

// Simulate lookup - even numbers are "found", odd are "not found"
const lookupNumber = (num: string): boolean => {
  const n = parseInt(num, 10);
  return n % 2 === 0;
};

type Phase = 'coat-input' | 'coat-found' | 'bag-input' | 'bag-found' | 'not-found' | 'order-view';

interface BetalingPageProps {
  items: OrderItem[];
  total: number;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onPin: () => void;
  onCash: () => void;
}

export const BetalingPage = ({
  items,
  total,
  onRemoveItem,
  onClear,
  onPin,
  onCash,
}: BetalingPageProps) => {
  const [phase, setPhase] = useState<Phase>('coat-input');
  const [number, setNumber] = useState('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [foundCode, setFoundCode] = useState('');

  // Auto-close numpad when 3 digits entered
  useEffect(() => {
    if (number.length >= 3 && (phase === 'coat-input' || phase === 'bag-input')) {
      // Auto-submit after short delay
      const timer = setTimeout(() => {
        handleSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [number, phase]);

  const handleSubmit = useCallback(() => {
    if (!number) return;
    const found = lookupNumber(number);

    if (phase === 'coat-input') {
      if (found) {
        setFoundCode('C' + number);
        setFeedback('success');
        setTimeout(() => {
          setFeedback(null);
          setPhase('order-view');
        }, 1000);
      } else {
        // Not found - try bag
        setFeedback('error');
        setTimeout(() => {
          setFeedback(null);
          setNumber('');
          setPhase('bag-input');
        }, 1000);
      }
    } else if (phase === 'bag-input') {
      if (found) {
        setFoundCode('B' + number);
        setFeedback('success');
        setTimeout(() => {
          setFeedback(null);
          setPhase('order-view');
        }, 1000);
      } else {
        setFeedback('error');
        setTimeout(() => {
          setFeedback(null);
          setNumber('');
          // Reset to coat input
          setPhase('coat-input');
        }, 1000);
      }
    }
  }, [number, phase]);

  const handleNumKey = (key: string) => {
    if (key === 'DEL') {
      setNumber('');
    } else if (number.length < 3) {
      setNumber(number + key);
    }
  };

  const handleReset = () => {
    setPhase('coat-input');
    setNumber('');
    setFoundCode('');
  };

  const hasItems = items.length > 0;

  // Number input phase (coat or bag)
  if (phase === 'coat-input' || phase === 'bag-input') {
    const label = phase === 'coat-input' ? 'JASNUMMER' : 'TASNUMMER';
    const subtitle = phase === 'bag-input' ? 'Jasnummer niet gevonden — probeer tasnummer' : undefined;

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <FeedbackOverlay type={feedback} />

        <h2
          className="font-extrabold uppercase tracking-[0.15em] text-center pt-3 pb-1"
          style={{ color: '#00cc13', fontSize: '29px' }}
        >
          {label}
        </h2>

        {subtitle && (
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest pb-1">
            {subtitle}
          </p>
        )}

        {/* Number field */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full" style={{ maxWidth: '280px' }}>
            <div
              className="w-full font-extrabold text-center flex items-center justify-center"
              style={{
                backgroundColor: '#d1d5db',
                color: '#111',
                fontSize: 'clamp(48px, 10vw, 80px)',
                padding: 'clamp(16px, 3vh, 32px) 16px',
                border: '3px solid #00cc13',
                boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330',
                transition: 'all 0.2s ease',
              }}
            >
              {number || <span style={{ color: '#9ca3af' }}>—</span>}
            </div>
          </div>
        </div>

        {/* Numpad */}
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

        {/* SEND button */}
        <div className="px-4 pb-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!number}
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
  }

  // Order view phase
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />

      {/* Order overview */}
      <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Bestelling — {foundCode} ({items.length} items)
          </h2>
          <button
            onClick={handleReset}
            className="text-xs font-bold uppercase tracking-widest px-2 py-1"
            style={{ color: '#00cc13' }}
          >
            NIEUW
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground uppercase tracking-widest">
              Geen producten — ga naar BAR
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between bg-secondary px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase">
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.product.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    [{item.product.code}]
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasItems && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <span className="text-sm font-bold uppercase tracking-widest">Totaal</span>
            <span className="text-2xl font-extrabold" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-0">
        <div className="flex">
          <button
            onClick={onPin}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 border-r border-border"
          >
            <CreditCard className="w-4 h-4" />
            PIN
          </button>
          <button
            onClick={onCash}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
          >
            <Banknote className="w-4 h-4" />
            CONTANT
          </button>
        </div>

        <button
          disabled={!hasItems}
          className="pos-btn py-5 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold uppercase"
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
