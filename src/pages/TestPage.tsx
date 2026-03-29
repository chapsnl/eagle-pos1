import { useState, useCallback, useEffect, useRef } from 'react';
import { DbProduct, useProducts, getTextColor } from '@/hooks/useProducts';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send, X } from 'lucide-react';
import { useFindActiveSessionByWardrobe, useUpdateSession, useAddDrinkLogs, useCreateSession } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
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

const NUM_KEYS = ['DEL', '1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'];

type Phase = 'input' | 'products';

export const TestPage = () => {

  const [phase, setPhase] = useState<Phase>('input');
  const [activeField, setActiveField] = useState<'coat' | 'bag' | null>(null);
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [items, setItems] = useState<TestOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [existingLogs, setExistingLogs] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number }[]>([]);
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
  const existingTotal = existingLogs.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const productMap = new Map((products ?? []).map((p) => [p.shorthand, p]));

  // Fetch existing drink logs when session changes
  useEffect(() => {
    if (!sessionId) { setExistingLogs([]); return; }
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('drink_logs')
        .select('price_at_time, product_id, products(full_name)')
        .eq('session_id', sessionId);
      if (!data) return;
      const map = new Map<string, { product_id: string; product_name: string; quantity: number; unit_price: number }>();
      for (const log of data) {
        const name = (log.products as any)?.full_name ?? 'Unknown';
        const pid = log.product_id;
        const existing = map.get(pid);
        if (existing) existing.quantity++;
        else map.set(pid, { product_id: pid, product_name: name, quantity: 1, unit_price: log.price_at_time });
      }
      setExistingLogs(Array.from(map.values()));
    };
    fetchLogs();
  }, [sessionId]);

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
      setTimeout(() => { setFeedback(null); setPhase('products'); setActiveField(null); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [findActiveSessionByWardrobe]);

  // Auto-lookup coat number at 3 digits
  useEffect(() => {
    if (phase !== 'input') return;
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
    if (phase !== 'input') return;
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
    if (key === 'DEL') {
      setCoatNumber('');
      setBagNumber('');
      setActiveField(null);
      lastCoatLookupRef.current = null;
      lastBagLookupRef.current = null;
      return;
    }
    if (activeField === 'coat') {
      if (coatNumber.length < 3) setCoatNumber(coatNumber + key);
    } else if (activeField === 'bag') {
      if (bagNumber.length < 3) setBagNumber(bagNumber + key);
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
  const [retourMode, setRetourMode] = useState(false);
  const [retourFlash, setRetourFlash] = useState<string | null>(null);

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
        setCoatNumber(''); setBagNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setPhase('input'); setActiveField(null);
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [items, sessionId, sessionTotal, total, addDrinkLogs, updateSession]);

  const orderSummary = (
    <div className="space-y-2 my-2 max-h-[50vh] overflow-y-auto">
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#888' }}>
        {coatNumber ? `C${coatNumber}` : ''}{bagNumber ? ` B${bagNumber}` : ''}
      </div>
      {existingLogs.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#666' }}>Eerder besteld</div>
          {existingLogs.map((l, idx) => (
            <div key={idx} className="flex justify-between font-bold" style={{ color: '#aaa', fontSize: 17 }}>
              <span>{l.quantity}× {l.product_name}</span>
              <span>€{(l.unit_price * l.quantity).toFixed(2)}</span>
            </div>
          ))}
        </>
      )}
      {items.length > 0 && (
        <>
          {existingLogs.length > 0 && <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#666' }}>Nieuw</div>}
          {items.map((i) => (
            <div key={i.product.id} className="flex justify-between font-bold" style={{ color: '#e5e5e5', fontSize: 17 }}>
              <span>{i.quantity}× {i.product.full_name}</span>
              <span>€{(i.product.price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
        </>
      )}
      <div className="border-t pt-2 flex justify-between font-extrabold text-base" style={{ borderColor: '#333', color: '#00cc13' }}>
        <span>TOTAAL</span>
        <span>€{(existingTotal + total).toFixed(2)}</span>
      </div>
    </div>
  );

  const bonDialog = (
    <Dialog open={showBonDialog} onOpenChange={(open) => { if (!open) setShowBonDialog(false); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340', borderRadius: 12 }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Bestelling</DialogTitle>
        </DialogHeader>
        {orderSummary}
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={() => setShowBonDialog(false)} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 4 }}>CANCEL</button>
          <button onClick={() => { setShowBonDialog(false); handleSubmit(); }} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380', borderRadius: 4 }}>VERWERK</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const payDialog = (
    <Dialog open={showPayDialog} onOpenChange={(open) => { if (!open) setShowPayDialog(false); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340', borderRadius: 12 }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Bestelling</DialogTitle>
        </DialogHeader>
        {orderSummary}
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={() => setShowPayDialog(false)} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 4 }}>CANCEL</button>
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
      setTimeout(() => { setFeedback(null); setPhase('products'); setActiveField(null); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [pendingWardrobe, createSession]);

  const handleCancelAdd = useCallback(() => {
    setShowAddDialog(false);
    setPendingWardrobe(null);
    setCoatNumber('');
    setBagNumber('');
    setActiveField(null);
    lastCoatLookupRef.current = null;
    lastBagLookupRef.current = null;
  }, []);

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

  // Instant book on product click
  const addAndBook = useCallback(async (product: DbProduct) => {
    if (!sessionId) return;

    // RETOUR MODE: remove one of this product from the bill
    if (retourMode) {
      const inItems = items.find((i) => i.product.id === product.id);
      const inExisting = existingLogs.find((l) => l.product_id === product.id);
      if (!inItems && !inExisting) return; // product not on bill at all

      // Flash animation
      setRetourFlash(product.id);
      setTimeout(() => setRetourFlash(null), 600);

      // Optimistic update: prefer removing from items first, then existingLogs
      if (inItems) {
        setItems((prev) => {
          const item = prev.find((i) => i.product.id === product.id);
          if (!item) return prev;
          if (item.quantity > 1) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i);
          return prev.filter((i) => i.product.id !== product.id);
        });
      } else {
        setExistingLogs((prev) => {
          const item = prev.find((l) => l.product_id === product.id);
          if (!item) return prev;
          if (item.quantity > 1) return prev.map((l) => l.product_id === product.id ? { ...l, quantity: l.quantity - 1 } : l);
          return prev.filter((l) => l.product_id !== product.id);
        });
      }

      try {
        // Find one drink_log for this product+session and delete it
        const { data: logToDelete } = await supabase
          .from('drink_logs')
          .select('id')
          .eq('session_id', sessionId)
          .eq('product_id', product.id)
          .limit(1)
          .maybeSingle();

        if (logToDelete) {
          await supabase.from('drink_logs').delete().eq('id', logToDelete.id);
          const newTotal = Math.max(0, sessionTotal - product.price);
          await updateSession.mutateAsync({ id: sessionId, total_amount: newTotal });
          setSessionTotal(newTotal);
        }
      } catch {
        // Revert on error
        if (inItems) {
          setItems((prev) => {
            const existing = prev.find((i) => i.product.id === product.id);
            if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [{ product, quantity: 1 }, ...prev];
          });
        } else {
          setExistingLogs((prev) => {
            const existing = prev.find((l) => l.product_id === product.id);
            if (existing) return prev.map((l) => l.product_id === product.id ? { ...l, quantity: l.quantity + 1 } : l);
            return [{ product_id: product.id, product_name: product.full_name, quantity: 1, unit_price: product.price }, ...prev];
          });
        }
      }
      return;
    }

    // NORMAL MODE: add product
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [{ product, quantity: 1 }, ...prev];
    });
    try {
      await addDrinkLogs.mutateAsync([{
        session_id: sessionId,
        product_id: product.id,
        price_at_time: product.price,
      }]);
      await updateSession.mutateAsync({
        id: sessionId,
        total_amount: sessionTotal + product.price,
      });
      setSessionTotal((prev) => prev + product.price);
    } catch {
      setItems((prev) => {
        const item = prev.find((i) => i.product.id === product.id);
        if (!item) return prev;
        if (item.quantity > 1) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i);
        return prev.filter((i) => i.product.id !== product.id);
      });
    }
  }, [sessionId, sessionTotal, addDrinkLogs, updateSession, retourMode, items, existingLogs]);

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

  // Products phase - split screen
  return (
    <div className="flex-1 flex overflow-hidden h-full relative" style={{ backgroundColor: '#1a1a1a', ...(retourMode ? { border: '4px solid #ef4444', boxShadow: 'inset 0 0 30px rgba(239,68,68,0.15)' } : {}) }}>
      <FeedbackOverlay type={feedback} />
      {bonDialog}
      {payDialog}

      {/* Retour mode banner */}
      {retourMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: '#ef4444', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>
          ⚠ RETOUR MODUS ACTIEF ⚠
        </div>
      )}

      {/* Left column - 20% - Guest overview */}
      <div className="flex flex-col h-full" style={{ width: '20%', backgroundColor: retourMode ? '#1a0a0a' : '#121212', borderRight: `1px solid ${retourMode ? '#ef4444' : '#333'}`, transition: 'background-color 0.3s ease' }}>
        {/* Guest number */}
        <div className="text-center py-3 border-b" style={{ borderColor: '#333' }}>
          <span className="font-extrabold" style={{ color: '#00ff00', fontSize: 'clamp(32px, 6vw, 56px)' }}>
            {coatNumber ? `C${coatNumber}` : ''}{bagNumber ? ` B${bagNumber}` : ''}
          </span>
        </div>

        {/* Scrollable order list */}
        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
          {/* Newly added items (this session) */}
          {items.map((i) => (
            <div key={i.product.id} className="flex justify-between items-center font-bold border-b" style={{ borderColor: '#2a2a2a', color: '#e5e5e5', fontSize: 'clamp(14px, 1.6vw, 26px)', padding: 'clamp(4px, 0.6vh, 10px) 0', whiteSpace: 'nowrap', transition: 'all 0.3s ease', ...(retourFlash === i.product.id ? { backgroundColor: '#ef444440', transform: 'scale(0.95)' } : {}) }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>
                {retourFlash === i.product.id && <span style={{ color: '#ef4444', marginRight: 4 }}>−</span>}
                {i.quantity}× {i.product.full_name}
              </span>
              <span style={{ color: '#00ff00', flexShrink: 0 }}>€{(i.product.price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
          {/* Previously ordered */}
          {existingLogs.length > 0 && (
            <>
              <div className="font-bold uppercase tracking-widest mt-2 mb-1" style={{ color: '#555', fontSize: 'clamp(8px, 0.8vw, 12px)' }}>Eerder</div>
              {existingLogs.map((l, idx) => (
                <div key={idx} className="flex justify-between items-center font-bold" style={{ color: '#777', fontSize: 'clamp(12px, 1.4vw, 22px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', transition: 'all 0.3s ease', ...(retourFlash === l.product_id ? { backgroundColor: '#ef444440', transform: 'scale(0.95)' } : {}) }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>
                    {retourFlash === l.product_id && <span style={{ color: '#ef4444', marginRight: 4 }}>−</span>}
                    {l.quantity}× {l.product_name}
                  </span>
                  <span style={{ color: '#00aa00', flexShrink: 0 }}>€{(l.unit_price * l.quantity).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Total at bottom */}
        <div className="px-2 py-2 border-t" style={{ borderColor: '#333', backgroundColor: '#00cc13' }}>
          <div className="flex justify-between font-extrabold" style={{ color: '#fff', fontSize: 'clamp(22px, 3vw, 42px)', whiteSpace: 'nowrap' }}>
            <span>TOTAAL</span>
            <span style={{ marginLeft: '8px' }}>€{(existingTotal + total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right column - 80% - Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '80%' }}>
        {gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => {
              // Row 5 (index 4), first cell -> PAY button
              if (ri === 4 && ci === 0) {
                return (
                  <button key={ci} onClick={() => setShowPayDialog(true)} style={{ flex: cell.span, backgroundColor: '#ef4444', color: '#fff' }} className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>PAY</span>
                  </button>
                );
              }
              // Row 6 (index 5), first cell -> BON button
              if (ri === 5 && ci === 0) {
                return (
                  <button key={ci} onClick={() => setShowBonDialog(true)} style={{ flex: cell.span, backgroundColor: '#1a3a6a', color: '#fff' }} className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>BON</span>
                  </button>
                );
              }
              // Row 6 (index 5), second cell -> RETOUR button
              if (ri === 5 && ci === 1) {
                return (
                  <button key={ci} onClick={() => setRetourMode((m) => !m)} style={{ flex: cell.span, backgroundColor: retourMode ? '#ef4444' : '#7c3aed', color: '#fff', transition: 'background-color 0.2s ease' }} className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>RETOUR</span>
                  </button>
                );
              }
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              const textColor = getTextColor(product.category_color);
              return (
                <button key={ci} onClick={() => addAndBook(product)} style={{ flex: cell.span, backgroundColor: product.category_color, color: textColor }} className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
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
    </div>
  );
};
