import { useState, useCallback, useEffect } from 'react';
import { Product, OrderItem, FeedbackType } from '@/types/pos';
import { products } from '@/data/products';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send } from 'lucide-react';

const gridLayout: { code: string; span: number; hideLabel?: boolean }[][] = [
  [
    { code: '1', span: 1 }, { code: 'DIV9', span: 1 }, { code: 'SHO', span: 1 }, { code: 'BAIL', span: 1 },
    { code: 'JAME', span: 2 }, { code: 'ABSO', span: 2 }, { code: 'HEIN', span: 2 },
  ],
  [
    { code: '20', span: 1 }, { code: '18', span: 1 }, { code: 'TTOP', span: 1 }, { code: 'MALI', span: 1 },
    { code: 'JACD', span: 2 }, { code: 'BOMB', span: 2 }, { code: 'GROL', span: 2 },
  ],
  [
    { code: '7', span: 1 }, { code: '12.5', span: 1 }, { code: 'AMAR', span: 1 }, { code: 'TEQU', span: 1 },
    { code: 'JIMB', span: 2 }, { code: 'APPC', span: 2 }, { code: 'COAF', span: 2 },
  ],
  [
    { code: '8', span: 1 }, { code: '10', span: 1 }, { code: 'TSHI', span: 1 }, { code: 'SAMB', span: 1 },
    { code: 'BSPI', span: 2 }, { code: 'WHIB', span: 2 }, { code: 'HE0%', span: 2 },
  ],
  [
    { code: '8', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'JAEG', span: 1 }, { code: 'LICO', span: 1 },
    { code: 'BACA', span: 2 }, { code: 'JENE', span: 2 }, { code: 'JUIC', span: 2 },
  ],
  [
    { code: '8', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'SEXT', span: 1 }, { code: 'STFF', span: 1 },
    { code: 'REDB', span: 2 }, { code: 'WINE', span: 2 }, { code: 'SOFT', span: 2 },
  ],
];

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

const productMap = new Map(products.map((p) => [p.code, p]));

// Simulate lookup: numbers ending in 0 are "not found", rest are found
const lookupNumber = (num: string): boolean => !num.endsWith('0');

type Phase = 'input-arm' | 'checking' | 'not-found' | 'input-bag' | 'products';

export const ArmNummerPage = () => {
  const [phase, setPhase] = useState<Phase>('input-arm');
  const [armNumber, setArmNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  // Auto-submit when 3 digits entered
  useEffect(() => {
    if (phase === 'input-arm' && armNumber.length >= 3) {
      // Lookup
      setTimeout(() => {
        if (lookupNumber(armNumber)) {
          setFeedback('success');
          setTimeout(() => {
            setFeedback(null);
            setPhase('products');
          }, 1000);
        } else {
          setPhase('not-found');
        }
      }, 300);
    }
  }, [armNumber, phase]);

  useEffect(() => {
    if (phase === 'input-bag' && bagNumber.length >= 3) {
      setTimeout(() => {
        setFeedback('success');
        setTimeout(() => {
          setFeedback(null);
          setPhase('products');
        }, 1000);
      }, 300);
    }
  }, [bagNumber, phase]);

  const handleNumKey = (key: string) => {
    if (phase === 'input-arm') {
      if (key === 'DEL') {
        setArmNumber('');
      } else if (armNumber.length < 3) {
        setArmNumber(armNumber + key);
      }
    } else if (phase === 'input-bag') {
      if (key === 'DEL') {
        setBagNumber('');
      } else if (bagNumber.length < 3) {
        setBagNumber(bagNumber + key);
      }
    }
  };

  const handleNotFoundContinue = () => {
    setPhase('input-bag');
  };

  const addProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (items.length === 0) return;
    console.log('Arm nummer order:', armNumber || bagNumber, items);
    setFeedback('success');
    setTimeout(() => {
      setFeedback(null);
      setArmNumber('');
      setBagNumber('');
      setItems([]);
      setPhase('input-arm');
    }, 2000);
  }, [armNumber, bagNumber, items]);

  // Number input phase (arm or bag)
  if (phase === 'input-arm' || phase === 'input-bag') {
    const value = phase === 'input-arm' ? armNumber : bagNumber;
    const label = phase === 'input-arm' ? 'ARM NUMMER' : 'TAS NUMMER';
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <FeedbackOverlay type={feedback} />

        <h2
          className="font-extrabold uppercase tracking-[0.15em] text-center pt-3 pb-2"
          style={{ color: '#00cc13', fontSize: '37px' }}
        >
          {label}
        </h2>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full" style={{ maxWidth: '280px' }}>
            <div
              className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center"
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
              {value || <span style={{ color: '#9ca3af' }}>—</span>}
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

        <div className="h-4" />
      </div>
    );
  }

  // Not found phase - show message
  if (phase === 'not-found') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center gap-6 px-4">
        <FeedbackOverlay type={feedback} />
        <div
          className="text-center font-extrabold uppercase tracking-[0.1em]"
          style={{ color: '#ef4444', fontSize: 'clamp(24px, 5vw, 40px)' }}
        >
          NIET GEVONDEN
        </div>
        <div className="text-center text-muted-foreground text-lg font-bold">
          Arm #{armNumber} niet gevonden.<br />Probeer met tasnummer.
        </div>
        <button
          onClick={handleNotFoundContinue}
          className="px-8 py-4 text-xl font-extrabold uppercase"
          style={{
            backgroundColor: '#00cc13',
            color: '#fff',
            boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
          }}
        >
          TAS NUMMER INVOEREN
        </button>
      </div>
    );
  }

  // Products phase
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <FeedbackOverlay type={feedback} />

      {/* Top bar */}
      <div className="bg-card border-b border-border p-2 flex items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          #{armNumber || bagNumber}
        </label>
        <div className="flex-1 text-sm overflow-hidden">
          {items.map((i) => (
            <span key={i.product.id} className="mr-2 text-xs font-bold">
              {i.quantity > 1 && `${i.quantity}×`}{i.product.code}
            </span>
          ))}
        </div>
        <span className="font-extrabold text-lg whitespace-nowrap" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => {
              if (!cell.code) {
                return <div key={ci} style={{ flex: cell.span }} className="border-[0.5px] border-black/10 bg-card" />;
              }
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              return (
                <button
                  key={ci}
                  onClick={() => addProduct(product)}
                  style={{
                    flex: cell.span,
                    backgroundColor: product.color,
                    color: product.textColor,
                  }}
                  className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 active:shadow-[inset_0_0_0_2px_hsl(var(--destructive)),0_0_12px_hsl(var(--destructive)/0.5)] p-1 min-w-0"
                >
                  <span
                    className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line"
                    style={{ fontSize: cell.span === 2 ? 'clamp(1.2rem, 3.5vw, 2.8rem)' : 'clamp(0.7rem, 2vw, 1.5rem)' }}
                  >
                    {cell.hideLabel ? '' : product.name}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* BOEK button */}
      <button
        onClick={handleSubmit}
        disabled={items.length === 0}
        className="pos-btn py-4 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}
      >
        <Send className="w-6 h-6" />
        BOEK — €{total.toFixed(2)}
      </button>
    </div>
  );
};
