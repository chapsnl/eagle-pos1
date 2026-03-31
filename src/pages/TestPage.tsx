import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { DbProduct, useProducts, getTextColor } from '@/hooks/useProducts';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send, X, Delete } from 'lucide-react';
import { useFindActiveSessionByWardrobe, useUpdateSession, useAddDrinkLogs, useCreateSession } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';
import { broadcastOrder, clearOrder } from '@/lib/orderSync';

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

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];

type Phase = 'input' | 'products';

interface TestPageProps {
  initialGuestNumber?: string | null;
  initialSessionData?: { sessionId: string; wardrobeNumber: string; totalAmount: number } | null;
  onGuestNumberConsumed?: () => void;
}

export const TestPage = ({ initialGuestNumber, initialSessionData, onGuestNumberConsumed }: TestPageProps) => {

  // Lock to landscape on this page
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const so = screen.orientation as any;
        if (so?.lock) await so.lock('landscape');
      } catch {}
    };
    lockOrientation();
    return () => {
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, []);

  const [phase, setPhase] = useState<Phase>('input');
  const [activeField, setActiveField] = useState<'coat' | null>('coat');
  const [coatNumber, setCoatNumber] = useState('');
  const [items, setItems] = useState<TestOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [existingLogs, setExistingLogs] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number }[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingWardrobe, setPendingWardrobe] = useState<string | null>(null);
  const [showClosedBlockDialog, setShowClosedBlockDialog] = useState(false);
  const lastCoatLookupRef = useRef<string | null>(null);
  const { data: products } = useProducts();
  const findActiveSessionByWardrobe = useFindActiveSessionByWardrobe();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const createSession = useCreateSession();

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const existingTotal = existingLogs.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const productMap = new Map((products ?? []).map((p) => [p.shorthand, p]));

  // Live drink logs via Realtime subscription + initial fetch
  const [liveDbLogs, setLiveDbLogs] = useState<{ product_id: string; product_name: string; quantity: number }[]>([]);

  const fetchLogsFromDb = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('drink_logs')
      .select('price_at_time, product_id, timestamp, products(full_name)')
      .eq('session_id', sid);
    if (!data) return;
    const map = new Map<string, { product_id: string; product_name: string; quantity: number; unit_price: number }>();
    const dbMap = new Map<string, { product_id: string; product_name: string; quantity: number; last_touched_at: number }>();
    for (const log of data) {
      const name = (log.products as any)?.full_name ?? 'Unknown';
      const pid = log.product_id;
      const touchedAt = new Date(log.timestamp).getTime();
      const existing = map.get(pid);
      if (existing) existing.quantity++;
      else map.set(pid, { product_id: pid, product_name: name, quantity: 1, unit_price: log.price_at_time });
      const dbExisting = dbMap.get(pid);
      if (dbExisting) {
        dbExisting.quantity++;
        dbExisting.last_touched_at = Math.max(dbExisting.last_touched_at, touchedAt);
      } else {
        dbMap.set(pid, { product_id: pid, product_name: name, quantity: 1, last_touched_at: touchedAt });
      }
    }
    setExistingLogs(Array.from(map.values()));
    setLiveDbLogs(
      Array.from(dbMap.values())
        .sort((a, b) => b.last_touched_at - a.last_touched_at)
        .map(({ last_touched_at, ...item }) => item)
    );
  }, []);

  useEffect(() => {
    if (!sessionId) { setExistingLogs([]); setLiveDbLogs([]); return; }
    fetchLogsFromDb(sessionId);
    const channel = supabase
      .channel(`drink_logs_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drink_logs', filter: `session_id=eq.${sessionId}` },
        () => { fetchLogsFromDb(sessionId); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchLogsFromDb]);

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
    const wardrobe = coatNumber;
    if (lastCoatLookupRef.current === wardrobe) return;
    lastCoatLookupRef.current = wardrobe;
    const t = window.setTimeout(async () => {
      // Pre-check: is this number already closed?
      const { data: closedSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('wardrobe_number', wardrobe)
        .in('status', ['paid', 'archived'])
        .limit(1)
        .maybeSingle();
      if (closedSession) {
        setPendingWardrobe(wardrobe);
        setShowClosedBlockDialog(true);
        return;
      }
      void resolveSessionByWardrobe(wardrobe, () => {
        setPendingWardrobe(wardrobe);
        setShowAddDialog(true);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [coatNumber, phase, resolveSessionByWardrobe]);

  // Handle direct navigation with full session data (e.g. from OPEN page BEWERK button)
  useEffect(() => {
    if (!initialSessionData) return;
    const num = initialSessionData.wardrobeNumber.replace(/\D/g, '');
    setCoatNumber(num);
    setSessionId(initialSessionData.sessionId);
    setSessionTotal(initialSessionData.totalAmount);
    setPhase('products');
    setActiveField(null);
    lastCoatLookupRef.current = num;
    onGuestNumberConsumed?.();
  }, [initialSessionData, onGuestNumberConsumed]);

  // Handle external navigation with a guest number (e.g. from OVERZICHT page)
  useEffect(() => {
    if (!initialGuestNumber || initialSessionData) return;
    const num = initialGuestNumber.replace(/\D/g, '');
    if (!num) return;
    setCoatNumber(num);
    lastCoatLookupRef.current = null;
    onGuestNumberConsumed?.();
  }, [initialGuestNumber, initialSessionData, onGuestNumberConsumed]);

  const handleNumKey = (key: string) => {
    if (key === 'DEL') {
      setCoatNumber('');
      setActiveField('coat');
      lastCoatLookupRef.current = null;
      return;
    }
    if (key === 'BACK') {
      if (activeField === 'coat') setCoatNumber(prev => prev.slice(0, -1));
      return;
    }
    if (activeField === 'coat') {
      if (coatNumber.length < 3) setCoatNumber(coatNumber + key);
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
  const [showEntreeWarning, setShowEntreeWarning] = useState(false);
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
        setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setPhase('input'); setActiveField('coat');
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [items, sessionId, sessionTotal, total, addDrinkLogs, updateSession]);

  const popupOrderLines: OrderLine[] = useMemo(() => {
    return liveDbLogs.map((l) => ({
      name: l.product_name,
      qty: l.quantity,
      price: 0,
    }));
  }, [liveDbLogs]);

  const handlePayVerwerk = useCallback(async () => {
    if (!sessionId) return;
    setShowPayDialog(false);
    try {
      await updateSession.mutateAsync({ id: sessionId, status: 'paid' });
      clearOrder();
      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setPhase('input'); setActiveField('coat'); setRetourMode(false); setLiveDbLogs([]);
        lastCoatLookupRef.current = null;
      }, 1500);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [sessionId, updateSession]);

  const bonDialog = (
    <SessionPopup
      open={showBonDialog}
      onClose={() => setShowBonDialog(false)}
      title="Bestelling"
      subtitle={coatNumber || ''}
      orderLines={popupOrderLines}
      showTotal={false}
      showItemCount
      actions={[
        { label: 'CANCEL', onClick: () => setShowBonDialog(false), variant: 'cancel' },
        { label: 'VERWERK', onClick: () => { setShowBonDialog(false); handleSubmit(); }, variant: 'confirm' },
      ]}
    />
  );

  const payDialog = (
    <SessionPopup
      open={showPayDialog}
      onClose={() => setShowPayDialog(false)}
      title="Bestelling"
      subtitle={coatNumber || ''}
      orderLines={popupOrderLines}
      showTotal={false}
      showItemCount
      actions={[
        { label: 'CANCEL', onClick: () => setShowPayDialog(false), variant: 'cancel' },
        { label: 'VERWERK', onClick: handlePayVerwerk, variant: 'confirm' },
      ]}
    />
  );

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingWardrobe) return;
    setShowAddDialog(false);
    try {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('wardrobe_number', pendingWardrobe)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (existing) {
        toast.error(`Gast ${pendingWardrobe} bestaat al als actieve klant!`);
        setPendingWardrobe(null);
        setCoatNumber('');
        lastCoatLookupRef.current = null;
        return;
      }
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
    setActiveField('coat');
    lastCoatLookupRef.current = null;
  }, []);

  const addDialog = (
    <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) handleCancelAdd(); }}>
      <DialogContent className="bg-card" style={{ borderColor: '#00cc1340', borderRadius: 12 }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>Nummer niet gevonden</DialogTitle>
          <DialogDescription className="text-sm pt-2">
            <span className="font-extrabold text-base" style={{ color: '#00cc13' }}>{pendingWardrobe}</span>{' '}
            Wil je dit nummer toevoegen?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-3">
          <button onClick={handleCancelAdd} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 6 }}>NEE</button>
          <button onClick={handleConfirmAdd} className="flex-1 py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380', borderRadius: 6 }}>JA</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleClosedBlockDismiss = useCallback(() => {
    setShowClosedBlockDialog(false);
    setPendingWardrobe(null);
    setCoatNumber('');
    setActiveField('coat');
    lastCoatLookupRef.current = null;
  }, []);

  const closedBlockDialog = (
    <SessionPopup
      open={showClosedBlockDialog}
      onClose={handleClosedBlockDismiss}
      title={`Nummer ${pendingWardrobe ?? ''} Geblokkeerd`}
      subtitle="Dit nummer is al afgerekend en gesloten. Vraag een manager om deze te heropenen via het Admin paneel."
      subtitleSize="clamp(0.85rem, 2vw, 1.15rem)"
      orderLines={[]}
      showTotal={false}
      actions={[
        { label: 'BEGREPEN', onClick: handleClosedBlockDismiss, variant: 'confirm' as const },
      ]}
    />
  );

  // Instant book on product click
  const addAndBook = useCallback(async (product: DbProduct) => {
    if (!sessionId) return;

    // RETOUR MODE: remove one of this product from the bill
    if (retourMode) {
      const inItems = items.find((i) => i.product.id === product.id);
      const inExisting = existingLogs.find((l) => l.product_id === product.id);
      if (!inItems && !inExisting) return;

      setRetourFlash(product.id);
      setTimeout(() => setRetourFlash(null), 600);

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
      setLiveDbLogs((prev) => {
        const item = prev.find((l) => l.product_id === product.id);
        if (!item) return prev;
        if (item.quantity > 1) return prev.map((l) => l.product_id === product.id ? { ...l, quantity: l.quantity - 1 } : l);
        return prev.filter((l) => l.product_id !== product.id);
      });

      setRetourMode(false);

      try {
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
    setLiveDbLogs((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        const rest = prev.filter((l) => l.product_id !== product.id);
        return [{ ...existing, quantity: existing.quantity + 1 }, ...rest];
      }
      return [{ product_id: product.id, product_name: product.full_name, quantity: 1 }, ...prev];
    });
    try {
      await addDrinkLogs.mutateAsync([{
        session_id: sessionId,
        product_id: product.id,
        price_at_time: product.price,
      }]);
      const newTotal = sessionTotal + product.price;
      await updateSession.mutateAsync({
        id: sessionId,
        total_amount: newTotal,
      });
      setSessionTotal(newTotal);

      const guestNum = coatNumber || '';
      const updatedItems = [...items];
      const ex = updatedItems.find((i) => i.product.id === product.id);
      if (ex) ex.quantity++;
      else updatedItems.unshift({ product, quantity: 1 });
      broadcastOrder({
        guestNumber: guestNum,
        sessionId,
        items: updatedItems.map((i) => ({ product_id: i.product.id, product_name: i.product.full_name, shorthand: i.product.shorthand, price: i.product.price, quantity: i.quantity })),
        totalAmount: newTotal + existingTotal,
        timestamp: Date.now(),
      });
    } catch {
      setItems((prev) => {
        const item = prev.find((i) => i.product.id === product.id);
        if (!item) return prev;
        if (item.quantity > 1) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i);
        return prev.filter((i) => i.product.id !== product.id);
      });
    }
  }, [sessionId, sessionTotal, addDrinkLogs, updateSession, retourMode, items, existingLogs, coatNumber, existingTotal]);

  // Input phase
  if (phase === 'input') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        <FeedbackOverlay type={feedback} />
        {addDialog}
        {closedBlockDialog}
        <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2" style={{ color: '#00cc13' }}>GAST ZOEKEN</h2>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full" style={{ maxWidth: '280px' }}>
            <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(16px, 3vh, 32px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
              {coatNumber || <span style={{ color: '#9ca3af' }}>—</span>}
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-0">
            {NUM_KEYS.map((key, i) => (
              <button key={i} onClick={() => key && handleNumKey(key)} disabled={!key} className="py-3 text-2xl font-extrabold uppercase disabled:invisible" style={{ backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a', color: '#fff', border: '1px solid #333' }}>
                {key === 'DEL' ? <X className="mx-auto w-6 h-6" /> : key === 'BACK' ? <Delete className="mx-auto w-6 h-6" /> : key}
              </button>
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
        <div className="text-center py-3 border-b" style={{ borderColor: '#333' }}>
          <span className="font-extrabold" style={{ color: '#00ff00', fontSize: 'clamp(32px, 6vw, 56px)' }}>
            {coatNumber || ''}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
        {liveDbLogs.map((item, index) => (
            <div key={item.product_id} style={{ color: '#e5e5e5', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', transition: 'all 0.3s ease', fontWeight: index === 0 ? 800 : 400, ...(retourFlash === item.product_id ? { backgroundColor: '#ef444440', transform: 'scale(0.95)' } : {}) }}>
              {retourFlash === item.product_id && <span style={{ color: '#ef4444', marginRight: 4 }}>−</span>}
              {item.quantity} x {item.product_name}
            </div>
          ))}
          {liveDbLogs.length === 0 && (
            <div className="text-center py-4" style={{ color: '#555', fontSize: 'clamp(10px, 1.2vw, 14px)' }}>Geen producten</div>
          )}
        </div>
      </div>

      {/* Right column - 80% - Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden gap-[1px]" style={{ width: '80%', backgroundColor: 'rgba(0,0,0,0.3)' }}>
        {gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex gap-[1px]" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => {
              // Row 4 (index 3), first cell -> ENT button (same color as '10' product = second cell)
              if (ri === 3 && ci === 0) {
                const eightProduct = productMap.get('8');
                const entBg = eightProduct?.category_color || '#888';
                const entTextColor = eightProduct ? getTextColor(eightProduct.category_color) : '#fff';
                return (
                  <button key={ci} onClick={() => { if (eightProduct) addAndBook(eightProduct); }} style={{ flex: cell.span, backgroundColor: entBg, color: entTextColor }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>8</span>
                  </button>
                );
              }
              // Row 5 (index 4), first cell -> PAY button
              if (ri === 4 && ci === 0) {
                return (
                  <button key={ci} onClick={() => setShowPayDialog(true)} style={{ flex: cell.span, backgroundColor: '#ef4444', color: '#fff' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>PAY</span>
                  </button>
                );
              }
              // Row 5 (index 4), second cell -> RETOUR button
              if (ri === 4 && ci === 1) {
                return (
                  <button key={ci} onClick={() => setRetourMode((m) => !m)} style={{ flex: cell.span, backgroundColor: retourMode ? '#ef4444' : '#7c3aed', color: '#fff', transition: 'background-color 0.2s ease' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>RETOUR</span>
                  </button>
                );
              }
              // Row 6 (index 5), first cell -> NEXT button
              if (ri === 5 && ci === 0) {
                return (
                  <button key={ci} onClick={() => { setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setPhase('input'); setActiveField('coat'); setRetourMode(false); }} style={{ flex: cell.span, backgroundColor: '#1a3a6a', color: '#fff' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>NEXT</span>
                  </button>
                );
              }
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              const textColor = getTextColor(product.category_color);
              return (
                <button key={ci} onClick={() => addAndBook(product)} style={{ flex: cell.span, backgroundColor: product.category_color, color: textColor }} className="pos-btn flex items-center justify-center active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
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
