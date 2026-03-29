import { useState, useCallback, useEffect, useRef } from 'react';
import { DbProduct, useProducts, getTextColor } from '@/hooks/useProducts';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send, X } from 'lucide-react';
import { useFindActiveSessionByWardrobe, useUpdateSession, useAddDrinkLogs, useCreateSession } from '@/hooks/useSessions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface TestOrderItem {
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

type Phase = 'input-coat' | 'input-bag' | 'products';

export const TestPage = () => {
  const [phase, setPhase] = useState<Phase>('input-coat');
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [items, setItems] = useState<TestOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingWardrobe, setPendingWardrobe] = useState<string | null>(null);
  const lastCoatLookupRef = useRef<string | null>(null);
  const lastBagLookupRef = useRef<string | null>(null);
  const { data: products } = useProducts();
  const findActiveSessionByWardrobe = useFindActiveSessionByWardrobe();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const createSession = useCreateSession();

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

  // Auto-lookup coat number at 3 digits
  useEffect(() => {
    if (phase !== 'input-coat') return;
    if (coatNumber.length < 3) { lastCoatLookupRef.current = null; return; }
    const wardrobe = `C${coatNumber}`;
    if (lastCoatLookupRef.current === wardrobe) return;
    lastCoatLookupRef.current = wardrobe;
    const t = window.setTimeout(() => {
      void resolveSessionByWardrobe(wardrobe, () => {
        setPendingWardrobe(wardrobe);
        setShowAddDialog(true);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [coatNumber, phase, resolveSessionByWardrobe]);

  // Auto-lookup bag number at 3 digits
  useEffect(() => {
    if (phase !== 'input-bag') return;
    if (bagNumber.length < 3) { lastBagLookupRef.current = null; return; }
    const wardrobe = `B${bagNumber}`;
    if (lastBagLookupRef.current === wardrobe) return;
    lastBagLookupRef.current = wardrobe;
    const t = window.setTimeout(() => {
      void resolveSessionByWardrobe(wardrobe, () => {
        setPendingWardrobe(wardrobe);
        setShowAddDialog(true);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [bagNumber, phase, resolveSessionByWardrobe]);

  const handleNumKey = (key: string) => {
    if (phase === 'input-coat') {
      if (key === 'DEL') setCoatNumber('');
      else if (coatNumber.length < 3) setCoatNumber(coatNumber + key);
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

  const [showBonDialog, setShowBonDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);

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
        setCoatNumber(''); setBagNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setPhase('input-coat');
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [items, sessionId, sessionTotal, total, addDrinkLogs, updateSession]);

  const orderSummary = (
    <div className="space-y-2 my-2">
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#888' }}>
        {coatNumber ? `C${coatNumber}` : ''}{bagNumber ? ` B${bagNumber}` : ''}
      </div>
      {items.map((i) => (
        <div key={i.product.id} className="flex justify-between text-sm font-bold" style={{ color: '#e5e5e5' }}>
          <span>{i.quantity}× {i.product.full_name}</span>
          <span>€{(i.product.price * i.quantity).toFixed(2)}</span>
        </div>
      ))}
      <div className="border-t pt-2 flex justify-between font-extrabold text-base" style={{ borderColor: '#333', color: '#00cc13' }}>
        <span>TOTAAL</span>
        <span>€{total.toFixed(2)}</span>
      </div>
    </div>
  );

  const bonDialog = (
    <Dialog open={showBonDialog} onOpenChange={(open) => { if (!open) setShowBonDialog(false); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340' }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Bestelling</DialogTitle>
        </DialogHeader>
        {orderSummary}
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={() => setShowBonDialog(false)} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}>CANCEL</button>
          <button onClick={() => { setShowBonDialog(false); handleSubmit(); }} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}>VERWERK</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const payDialog = (
    <Dialog open={showPayDialog} onOpenChange={(open) => { if (!open) setShowPayDialog(false); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340' }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Bestelling</DialogTitle>
        </DialogHeader>
        {orderSummary}
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={() => setShowPayDialog(false)} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}>CANCEL</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingWardrobe) return;
    setShowAddDialog(false);
    try {
      const session = await createSession.mutateAsync({
        wardrobe_number: pendingWardrobe,
        is_event_numbered: true,
      });
      setSessionId(session.id);
      setSessionTotal(Number(session.total_amount ?? 0));
      setPendingWardrobe(null);
      setFeedback('success');
      setTimeout(() => { setFeedback(null); setPhase('products'); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [pendingWardrobe, createSession]);

  const handleCancelAdd = useCallback(() => {
    setShowAddDialog(false);
    setPendingWardrobe(null);
    if (phase === 'input-coat') setCoatNumber('');
    else if (phase === 'input-bag') setBagNumber('');
    lastCoatLookupRef.current = null;
    lastBagLookupRef.current = null;
  }, [phase]);

  const addDialog = (
    <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) handleCancelAdd(); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340' }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Nummer niet gevonden</DialogTitle>
          <DialogDescription className="text-sm pt-2">
            <span className="font-extrabold text-base" style={{ color: '#00cc13' }}>{pendingWardrobe}</span>{' '}
            Wil je dit nummer toevoegen?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={handleCancelAdd} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}>NEE</button>
          <button onClick={handleConfirmAdd} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}>JA</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Input phases: coat first, then bag
  if (phase === 'input-coat' || phase === 'input-bag') {
    const value = phase === 'input-coat' ? coatNumber : bagNumber;
    const label = phase === 'input-coat' ? 'COAT NUMMER' : 'BAG NUMMER';
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <FeedbackOverlay type={feedback} />
        {addDialog}
        <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2" style={{ color: '#00cc13' }}>{label}</h2>
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

  // Products phase
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <FeedbackOverlay type={feedback} />
      {bonDialog}
      {payDialog}
      <div className="min-h-10 bg-card border-b border-border flex items-center px-2 gap-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          {coatNumber ? `C${coatNumber}` : ''}{bagNumber ? `B${bagNumber}` : ''}
        </label>
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1">
          {items.map((i) => (
            <button
              key={i.product.id}
              onClick={() => setItems(prev => {
                const item = prev.find(x => x.product.id === i.product.id);
                if (!item) return prev;
                if (item.quantity > 1) return prev.map(x => x.product.id === i.product.id ? { ...x, quantity: x.quantity - 1 } : x);
                return prev.filter(x => x.product.id !== i.product.id);
              })}
              className="flex items-center gap-1 bg-secondary rounded px-2 py-1 text-[10px] font-bold uppercase shrink-0 hover:bg-destructive/20 transition-colors group"
            >
              <span>{i.quantity > 1 && `${i.quantity}×`}{i.product.shorthand}</span>
              <X className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-extrabold text-sm" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
          <button onClick={() => setItems([])} className="pos-btn text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5">
            WISSEN
          </button>
        </div>
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
                  onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line" style={{ fontSize: cell.span === 2 ? 'clamp(0.96rem, 3.04vw, 2.48rem)' : 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>
                    {cell.hideLabel ? '' : product.full_name}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="flex flex-col" style={{ flex: 1 }}>
          <button onClick={() => items.length > 0 && setShowBonDialog(true)} disabled={items.length === 0} className="pos-btn flex-1 py-3 text-lg font-extrabold uppercase flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" style={{ backgroundColor: '#1a3a6a', color: '#fff' }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >BON</button>
          <button onClick={() => items.length > 0 && setShowPayDialog(true)} disabled={items.length === 0} className="pos-btn flex-1 py-3 text-lg font-extrabold uppercase flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" style={{ backgroundColor: '#ef4444', color: '#fff' }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >PAY</button>
        </div>
        <button onClick={handleSubmit} disabled={items.length === 0} className="pos-btn py-4 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed" style={{ flex: 9, backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}>
          <Send className="w-6 h-6" />
          BOEK — €{total.toFixed(2)}
        </button>
      </div>
    </div>
  );
};
