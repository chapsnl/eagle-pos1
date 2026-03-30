import { useState, useCallback, useRef, useEffect } from 'react';
import { DbProduct } from '@/hooks/useProducts';
import { FeedbackType, AppView } from '@/types/pos';
import IntroPage from './IntroPage';
import { NavTabs } from '@/components/pos/NavTabs';
import { OrderBar } from '@/components/pos/OrderBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { AdminPage } from './AdminPage';
import { OpenPage } from './OpenPage';
import { ClosedPage } from './ClosedPage';
import { TestPage } from './TestPage';
import { Send } from 'lucide-react';
import { useCreateSession, useAddDrinkLogs, useUpdateSession, useFindActiveSessionByWardrobe } from '@/hooks/useSessions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { broadcastOrder, clearOrder, SyncOrderItem } from '@/lib/orderSync';

export interface DbOrderItem {
  product: DbProduct;
  quantity: number;
}

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];
const ENTRY_STORAGE_KEY = 'pos_started';

const readStartedFlag = () => {
  try {
    const persisted = localStorage.getItem(ENTRY_STORAGE_KEY);
    if (persisted === '1') return true;

    const legacySessionValue = sessionStorage.getItem(ENTRY_STORAGE_KEY);
    if (legacySessionValue === '1') {
      localStorage.setItem(ENTRY_STORAGE_KEY, '1');
      return true;
    }
  } catch {
    // Ignore storage access issues and fall back to intro page
  }

  return false;
};

type BarPhase = 'input-number' | 'products';

const Index = () => {
  
  const [started, setStarted] = useState(readStartedFlag);

  const handleEnter = useCallback(() => {
    try {
      localStorage.setItem(ENTRY_STORAGE_KEY, '1');
      sessionStorage.setItem(ENTRY_STORAGE_KEY, '1');
    } catch {
      // Ignore storage access issues and continue in-memory
    }
    setStarted(true);
  }, []);
  const [activeView, setActiveView] = useState<AppView>('test');
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [pendingGuestNumber, setPendingGuestNumber] = useState<string | null>(null);
  const [pendingSessionData, setPendingSessionData] = useState<{ sessionId: string; wardrobeNumber: string; totalAmount: number } | null>(null);

  // Bar number entry state
  const [barPhase, setBarPhase] = useState<BarPhase>('input-number');
  const [barNumber, setBarNumber] = useState('');
  const [barSessionId, setBarSessionId] = useState<string | null>(null);
  const [barSessionTotal, setBarSessionTotal] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingWardrobe, setPendingWardrobe] = useState<string | null>(null);
  const lastLookupRef = useRef<string | null>(null);

  const createSession = useCreateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const updateSession = useUpdateSession();
  const findActiveSessionByWardrobe = useFindActiveSessionByWardrobe();

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const addProduct = useCallback((product: DbProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      if (item.quantity > 1) return prev.map((i) => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter((i) => i.product.id !== productId);
    });
  }, []);

  const clearItems = useCallback(() => setItems([]), []);

  const showFeedback = useCallback((type: FeedbackType) => {
    setFeedback(type);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  // Reset bar phase when switching views
  useEffect(() => {
    if (activeView !== 'bar') {
      setBarPhase('input-number');
      setBarNumber('');
      setBarSessionId(null);
      setBarSessionTotal(0);
      setItems([]);
      lastLookupRef.current = null;
    }
  }, [activeView]);

  const resolveSessionByWardrobe = useCallback(async (wardrobeNum: string, onNotFound: () => void) => {
    try {
      const session = await findActiveSessionByWardrobe.mutateAsync(wardrobeNum);
      if (!session) {
        onNotFound();
        return;
      }
      setBarSessionId(session.id);
      setBarSessionTotal(Number(session.total_amount ?? 0));
      setFeedback('success');
      setTimeout(() => { setFeedback(null); setBarPhase('products'); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [findActiveSessionByWardrobe]);

  // Auto-lookup when 3 digits entered
  useEffect(() => {
    if (barPhase !== 'input-number' || activeView !== 'bar') return;
    if (barNumber.length < 3) {
      lastLookupRef.current = null;
      return;
    }
    const wardrobe = barNumber;
    if (lastLookupRef.current === wardrobe) return;
    lastLookupRef.current = wardrobe;

    const t = window.setTimeout(() => {
      void resolveSessionByWardrobe(wardrobe, () => {
        setPendingWardrobe(wardrobe);
        setShowAddDialog(true);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [barNumber, barPhase, activeView, resolveSessionByWardrobe]);

  const handleNumKey = (key: string) => {
    if (key === 'DEL') setBarNumber('');
    else if (barNumber.length < 3) setBarNumber(barNumber + key);
  };

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingWardrobe) return;
    setShowAddDialog(false);
    try {
      const session = await createSession.mutateAsync({
        wardrobe_number: pendingWardrobe,
        is_event_numbered: true,
      });
      setBarSessionId(session.id);
      setBarSessionTotal(Number(session.total_amount ?? 0));
      setPendingWardrobe(null);
      setFeedback('success');
      setTimeout(() => { setFeedback(null); setBarPhase('products'); }, 1000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [pendingWardrobe, createSession]);

  const handleCancelAdd = useCallback(() => {
    setShowAddDialog(false);
    setPendingWardrobe(null);
    setBarNumber('');
    lastLookupRef.current = null;
  }, []);

  // Broadcast current order to localStorage whenever items/session change
  useEffect(() => {
    if (activeView !== 'bar' || barPhase !== 'products' || !barSessionId) return;
    const syncItems: SyncOrderItem[] = items.map((i) => ({
      product_id: i.product.id,
      product_name: i.product.full_name,
      shorthand: i.product.shorthand,
      price: i.product.price,
      quantity: i.quantity,
    }));
    broadcastOrder({
      guestNumber: barNumber,
      sessionId: barSessionId,
      items: syncItems,
      totalAmount: barSessionTotal + total,
      timestamp: Date.now(),
    });
  }, [items, barSessionId, barNumber, barSessionTotal, total, activeView, barPhase]);

  const handleBoek = useCallback(async () => {
    if (items.length === 0 || !barSessionId) return;
    try {
      const logs = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          session_id: barSessionId,
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );
      await addDrinkLogs.mutateAsync(logs);
      await updateSession.mutateAsync({
        id: barSessionId,
        total_amount: barSessionTotal + total,
      });

      broadcastOrder({
        guestNumber: barNumber,
        sessionId: barSessionId,
        items: items.map((i) => ({ product_id: i.product.id, product_name: i.product.full_name, shorthand: i.product.shorthand, price: i.product.price, quantity: i.quantity })),
        totalAmount: barSessionTotal + total,
        timestamp: Date.now(),
      });

      showFeedback('success');
      setTimeout(() => {
        setItems([]);
        setBarNumber('');
        setBarSessionId(null);
        setBarSessionTotal(0);
        setBarPhase('input-number');
        lastLookupRef.current = null;
        clearOrder();
      }, 2000);
    } catch {
      showFeedback('error');
    }
  }, [items, barSessionId, barSessionTotal, total, barNumber, addDrinkLogs, updateSession, showFeedback]);


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

  if (!started) return <IntroPage onEnter={handleEnter} />;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      {addDialog}
      <NavTabs activeView={activeView} onViewChange={setActiveView} itemCount={items.length} />

      {activeView === 'bar' && barPhase === 'input-number' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full" style={{ maxWidth: '280px' }}>
              <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(16px, 3vh, 32px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                {barNumber || <span style={{ color: '#9ca3af' }}>—</span>}
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
      )}

      {activeView === 'bar' && barPhase === 'products' && (
        <>
          <OrderBar items={items} total={total} onRemoveItem={removeItem} onClear={clearItems} />
          <ProductGrid onAddProduct={addProduct} />
          <div className="pb-[max(0px,env(safe-area-inset-bottom))]">
            <button
              onClick={handleBoek}
              disabled={items.length === 0}
              className="pos-btn w-full py-3 text-lg flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-75"
              style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20' }}
            >
              <Send className="w-5 h-5" />
              BOEK — €{total.toFixed(2)}
            </button>
          </div>
        </>
      )}

      {activeView === 'test' && <TestPage initialGuestNumber={pendingGuestNumber} initialSessionData={pendingSessionData} onGuestNumberConsumed={() => { setPendingGuestNumber(null); setPendingSessionData(null); }} />}
      {activeView === 'admin' && <AdminPage />}
      {activeView === 'open' && <OpenPage onNavigateToGuest={(wardrobe, sessionId, totalAmount) => {
        setPendingSessionData({ sessionId, wardrobeNumber: wardrobe, totalAmount });
        setActiveView('test');
      }} />}
      {activeView === 'closed' && <ClosedPage />}
    </div>
  );
};

export default Index;
