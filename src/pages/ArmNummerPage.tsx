import { useState, useCallback, useEffect } from 'react';
import { DbProduct, useProducts, getTextColor } from '@/hooks/useProducts';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send } from 'lucide-react';
import { useFindActiveSessionByWardrobe, useUpdateSession, useAddDrinkLogs } from '@/hooks/useSessions';

interface ArmOrderItem {
  product: DbProduct;
  quantity: number;
}

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

type Phase = 'input-arm' | 'not-found' | 'input-bag' | 'bag-not-found' | 'products';

export const ArmNummerPage = () => {
  const [phase, setPhase] = useState<Phase>('input-arm');
  const [armNumber, setArmNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [items, setItems] = useState<ArmOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const { data: products } = useProducts();
  const findActiveSessionByWardrobe = useFindActiveSessionByWardrobe();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const productMap = new Map((products ?? []).map((p) => [p.shorthand, p]));

  const resolveSessionByWardrobe = useCallback(async (wardrobeNum: string, onNotFound: () => void) => {
    try {
      const session = await findActiveSessionByWardrobe.mutateAsync(wardrobeNum);
      if (!session) {
        onNotFound();
        return;
      }
      setSessionId(session.id);
      setSessionTotal(Number(session.total_amount ?? 0));
      setFeedback('success');
      setTimeout(() => { setFeedback(null); setPhase('products'); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [findActiveSessionByWardrobe]);

  useEffect(() => {
    if (phase === 'input-arm' && armNumber.length >= 3) {
      setTimeout(() => {
        void resolveSessionByWardrobe(`C${armNumber}`, () => setPhase('not-found'));
      }, 300);
    }
  }, [armNumber, phase, resolveSessionByWardrobe]);

  useEffect(() => {
    if (phase === 'input-bag' && bagNumber.length >= 3) {
      setTimeout(() => {
        void resolveSessionByWardrobe(`B${bagNumber}`, () => {
          setFeedback('error');
          setTimeout(() => setFeedback(null), 1500);
          setBagNumber('');
        });
      }, 300);
    }
  }, [bagNumber, phase, resolveSessionByWardrobe]);

  const handleNumKey = (key: string) => {
    if (phase === 'input-arm') {
      if (key === 'DEL') setArmNumber('');
      else if (armNumber.length < 3) setArmNumber(armNumber + key);
    } else if (phase === 'input-bag') {
      if (key === 'DEL') setBagNumber('');
      else if (bagNumber.length < 3) setBagNumber(bagNumber + key);
    }
  };

  const addProduct = useCallback((product: DbProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (items.length === 0 || !sessionId) return;
    try {
      const logs = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          session_id: sessionId,
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );
      await addDrinkLogs.mutateAsync(logs);
      await updateSession.mutateAsync({
        id: sessionId,
        total_amount: sessionTotal + total,
      });
      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        setArmNumber(''); setBagNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setPhase('input-arm');
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [items, sessionId, sessionTotal, total, addDrinkLogs, updateSession]);

  if (phase === 'input-arm' || phase === 'input-bag') {
    const value = phase === 'input-arm' ? armNumber : bagNumber;
    const label = phase === 'input-arm' ? 'ARM NUMMER' : 'TAS NUMMER';
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <FeedbackOverlay type={feedback} />
        <h2 className="font-extrabold uppercase tracking-[0.15em] text-center pt-3 pb-2" style={{ color: '#00cc13', fontSize: '37px' }}>{label}</h2>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full" style={{ maxWidth: '280px' }}>
            <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(16px, 3vh, 32px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330' }}>
              {value || <span style={{ color: '#9ca3af' }}>—</span>}
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-0">
            {NUM_KEYS.map((key, i) => (
              <button key={i} onClick={() => key && handleNumKey(key)} disabled={!key} className="py-3 text-2xl font-extrabold uppercase disabled:invisible" style={{ backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a', color: key === 'DEL' ? '#fff' : '#e5e5e5', border: '1px solid #333' }}>{key}</button>
            ))}
          </div>
        </div>
        <div className="h-4" />
      </div>
    );
  }

  if (phase === 'not-found') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center gap-6 px-4">
        <FeedbackOverlay type={feedback} />
        <div className="text-center font-extrabold uppercase tracking-[0.1em]" style={{ color: '#ef4444', fontSize: 'clamp(24px, 5vw, 40px)' }}>NIET GEVONDEN</div>
        <div className="text-center text-muted-foreground text-lg font-bold">Arm #{armNumber} niet gevonden.<br />Probeer met tasnummer.</div>
        <button onClick={() => setPhase('input-bag')} className="px-8 py-4 text-xl font-extrabold uppercase" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}>TAS NUMMER INVOEREN</button>
      </div>
    );
  }

  if (phase === 'bag-not-found') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center gap-6 px-4">
        <FeedbackOverlay type={feedback} />
        <div className="text-center font-extrabold uppercase tracking-[0.1em]" style={{ color: '#ef4444', fontSize: 'clamp(24px, 5vw, 40px)' }}>NIET GEVONDEN</div>
        <div className="text-center text-muted-foreground text-lg font-bold">Tas #{bagNumber} niet gevonden.</div>
        <button onClick={() => { setBagNumber(''); setPhase('input-bag'); }} className="px-8 py-4 text-xl font-extrabold uppercase mb-3" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}>OPNIEUW PROBEREN</button>
        <button onClick={() => { setArmNumber(''); setBagNumber(''); setPhase('input-arm'); }} className="px-8 py-4 text-xl font-extrabold uppercase" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 16px #ef444480, 0 0 32px #ef444430' }}>JAS INVOER?</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <FeedbackOverlay type={feedback} />
      <div className="bg-card border-b border-border p-2 flex items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">#{armNumber || bagNumber}</label>
        <div className="flex-1 text-sm overflow-hidden">
          {items.map((i) => (
            <span key={i.product.id} className="mr-2 text-xs font-bold">{i.quantity > 1 && `${i.quantity}×`}{i.product.shorthand}</span>
          ))}
        </div>
        <span className="font-extrabold text-lg whitespace-nowrap" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => {
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              const textColor = getTextColor(product.category_color);
              return (
                <button key={ci} onClick={() => addProduct(product)} style={{ flex: cell.span, backgroundColor: product.category_color, color: textColor }} className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
                  onPointerDown={(e) => { e.currentTarget.style.boxShadow = 'inset 0 0 0 3px #ff0000, 0 0 15px #ff0000'; }}
                  onPointerUp={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                  onPointerLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line" style={{ fontSize: cell.span === 2 ? 'clamp(1.01rem, 3.2vw, 2.61rem)' : 'clamp(0.51rem, 1.7vw, 1.31rem)' }}>
                    {cell.hideLabel ? '' : product.full_name}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={items.length === 0} className="pos-btn py-4 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed" style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}>
        <Send className="w-6 h-6" />
        BOEK — €{total.toFixed(2)}
      </button>
    </div>
  );
};
