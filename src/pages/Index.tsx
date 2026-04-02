import { useState, useCallback, useRef, useEffect } from 'react';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
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
import { Send, X, Delete, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCreateSession, useAddDrinkLogs, useUpdateSession, useFindActiveSessionByWardrobe } from '@/hooks/useSessions';
import { SessionPopup } from '@/components/pos/SessionPopup';
import { broadcastOrder, clearOrder, SyncOrderItem } from '@/lib/orderSync';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';

export interface DbOrderItem {
  product: DbProduct;
  quantity: number;
}

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'BACK'];
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
  const [barRetourMode, setBarRetourMode] = useState(false);
  const [showBarPayDialog, setShowBarPayDialog] = useState(false);
  const [showBarLockedWarning, setShowBarLockedWarning] = useState(false);
  const deviceId = useRef(getDeviceId()).current;

  const lockSession = useCallback(async (sid: string) => {
    await supabase.from('sessions').update({ locked_by: deviceId, locked_at: new Date().toISOString() } as any).eq('id', sid);
  }, [deviceId]);

  const unlockSession = useCallback(async (sid: string) => {
    await supabase.from('sessions').update({ locked_by: null, locked_at: null } as any).eq('id', sid);
  }, []);

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
    if (type === 'success') return; // no delay for success
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
      setBarRetourMode(false);
      setShowBarPayDialog(false);
    }
  }, [activeView]);

  const resolveSessionByWardrobe = useCallback(async (wardrobeNum: string, onNotFound: () => void) => {
    try {
      const session = await findActiveSessionByWardrobe.mutateAsync(wardrobeNum);
      if (!session) {
        onNotFound();
        return;
      }
      // Check if locked by another device
      const lockedBy = (session as any).locked_by;
      const lockedAt = (session as any).locked_at;
      if (lockedBy && lockedBy !== deviceId) {
        const lockAge = lockedAt ? Date.now() - new Date(lockedAt).getTime() : Infinity;
        if (lockAge < 60000) {
          setShowBarLockedWarning(true);
          return;
        }
      }
      await lockSession(session.id);
      setBarSessionId(session.id);
      setBarSessionTotal(Number(session.total_amount ?? 0));
      setBarPhase('products');
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [findActiveSessionByWardrobe, deviceId, lockSession]);

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
    if (key === 'DEL') {
      setBarNumber('');
      lastLookupRef.current = null;
      return;
    }
    if (key === 'BACK') {
      setBarNumber(prev => prev.slice(0, -1));
      return;
    }
    if (barNumber.length < 3) setBarNumber(barNumber + key);
  };

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingWardrobe) return;
    setShowAddDialog(false);
    try {
      const session = await createSession.mutateAsync({
        wardrobe_number: pendingWardrobe,
        is_event_numbered: true,
      });
      await lockSession(session.id);
      setBarSessionId(session.id);
      setBarSessionTotal(Number(session.total_amount ?? 0));
      setPendingWardrobe(null);
      setBarPhase('products');
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [pendingWardrobe, createSession, lockSession]);

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

      await unlockSession(barSessionId);
      setItems([]);
      setBarNumber('');
      setBarSessionId(null);
      setBarSessionTotal(0);
      setBarPhase('input-number');
      lastLookupRef.current = null;
      clearOrder();
    } catch {
      showFeedback('error');
    }
  }, [items, barSessionId, barSessionTotal, total, barNumber, addDrinkLogs, updateSession, showFeedback, unlockSession]);

  const handleBarPayVerwerk = useCallback(async () => {
    if (!barSessionId) return;
    setShowBarPayDialog(false);
    try {
      if (items.length > 0) {
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
          status: 'paid',
          total_amount: barSessionTotal + total,
        });
      } else {
        await updateSession.mutateAsync({ id: barSessionId, status: 'paid' });
      }
      await unlockSession(barSessionId);
      clearOrder();
      setItems([]);
      setBarNumber('');
      setBarSessionId(null);
      setBarSessionTotal(0);
      setBarPhase('input-number');
      setBarRetourMode(false);
      lastLookupRef.current = null;
    } catch {
      showFeedback('error');
    }
  }, [barSessionId, items, barSessionTotal, total, addDrinkLogs, updateSession, showFeedback, unlockSession]);

  const handleBarNext = useCallback(async () => {
    if (barSessionId) await unlockSession(barSessionId);
    setItems([]);
    setBarNumber('');
    setBarSessionId(null);
    setBarSessionTotal(0);
    setBarPhase('input-number');
    setBarRetourMode(false);
    lastLookupRef.current = null;
    clearOrder();
  }, [barSessionId, unlockSession]);

  // 20s inactivity timer: reset to input-number when idle in products phase
  // Pause timer when any popup/dialog is open
  const anyBarPopupOpen = showAddDialog || showBarPayDialog || showBarLockedWarning;
  useInactivityTimer(activeView === 'bar' && barPhase === 'products' && !anyBarPopupOpen, handleBarNext);

  const handleBarLockedDismiss = useCallback(() => {
    setShowBarLockedWarning(false);
    setBarNumber('');
    lastLookupRef.current = null;
  }, []);

  const handleBarAddProduct = useCallback((product: DbProduct) => {
    if (barRetourMode) {
      removeItem(product.id);
      setBarRetourMode(false);
      return;
    }
    addProduct(product);
  }, [barRetourMode, addProduct, removeItem]);

  const addDialog = (
    <SessionPopup
      open={showAddDialog}
      onClose={handleCancelAdd}
      title="Nummer niet gevonden"
      subtitle={`${pendingWardrobe} — Wil je dit nummer toevoegen?`}
      orderLines={[]}
      actions={[
        { label: 'NEE', onClick: handleCancelAdd, variant: 'cancel' },
        { label: 'JA', onClick: handleConfirmAdd, variant: 'confirm' },
      ]}
    />
  );

  const barPayDialog = (
    <SessionPopup
      open={showBarPayDialog}
      onClose={() => setShowBarPayDialog(false)}
      title="Bestelling"
      subtitle={barNumber || ''}
      orderLines={items.map((i) => ({ name: i.product.full_name, qty: i.quantity, price: 0 }))}
      showTotal={false}
      showItemCount
      actions={[
        { label: 'CANCEL', onClick: () => setShowBarPayDialog(false), variant: 'cancel' as const },
        { label: 'VERWERK', onClick: handleBarPayVerwerk, variant: 'confirm' as const },
      ]}
    />
  );

  const barLockedDialog = (
    <Dialog open={showBarLockedWarning} onOpenChange={(open) => { if (!open) handleBarLockedDismiss(); }}>
      <DialogContent className="bg-card flex flex-col items-center gap-4 py-8" style={{ borderColor: '#ef444440', borderRadius: 12, maxWidth: 360 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px #ef444480' }}>
          <AlertCircle className="w-12 h-12 text-white" />
        </div>
        <p className="text-center font-extrabold text-lg px-4" style={{ color: '#ef4444' }}>
          Let op: Een andere medewerker is momenteel bezig met deze gast.
        </p>
        <button onClick={handleBarLockedDismiss} className="w-full max-w-[200px] py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 6 }}>OK</button>
      </DialogContent>
    </Dialog>
  );

  if (!started) return <IntroPage onEnter={handleEnter} />;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      {addDialog}
      {barPayDialog}
      {barLockedDialog}
      <NavTabs activeView={activeView} onViewChange={setActiveView} itemCount={items.length} />

      {activeView === 'bar' && (
        barPhase === 'input-number' ? (
          <div className="bg-black w-full h-full flex-1 flex md:hidden xl:flex overflow-hidden items-center justify-center relative">
            <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
              <img src="/placeholder.svg" alt="" className="object-cover w-full h-full opacity-10" />
            </div>
            <div className="w-full max-w-sm mx-auto h-full max-h-[70vh] flex flex-col justify-center px-4 relative z-10">
              <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2 shrink-0 relative z-10" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
              <div className="flex items-center justify-center py-2 mb-6 shrink-0 relative z-10">
                <div className="w-full" style={{ maxWidth: '280px' }}>
                  <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                    {barNumber || <span style={{ color: '#9ca3af' }}>—</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 flex-1 min-h-0 pb-2 relative z-10">
                {NUM_KEYS.map((key, i) => (
                  <button key={i} onClick={() => key && handleNumKey(key)} disabled={!key} className="h-full min-h-[50px] w-full text-2xl font-extrabold uppercase disabled:invisible flex items-center justify-center" style={{ backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a', color: '#fff', border: '1px solid #333' }}>
                    {key === 'DEL' ? <X className="w-6 h-6" /> : key === 'BACK' ? <Delete className="w-6 h-6" /> : key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative md:hidden xl:flex">
            <OrderBar items={items} total={total} onRemoveItem={removeItem} onClear={clearItems} />
            <ProductGrid onAddProduct={barPhase === 'products' ? handleBarAddProduct : () => {}} />
            <div className="pb-[max(0px,env(safe-area-inset-bottom))]">
              <button
                onClick={handleBoek}
                disabled={items.length === 0 || barPhase !== 'products'}
                className="pos-btn w-full min-h-[80px] py-4 text-2xl font-extrabold flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-75"
                style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20' }}
              >
                <Send className="w-6 h-6" />
                BOEK — €{total.toFixed(2)}
              </button>
            </div>
          </div>
        )
      )}

      {activeView === 'test' && <TestPage initialGuestNumber={pendingGuestNumber} initialSessionData={pendingSessionData} onGuestNumberConsumed={() => { setPendingGuestNumber(null); setPendingSessionData(null); }} />}
      {activeView === 'admin' && <AdminPage onNavigateToGuest={(wardrobe, sessionId, totalAmount) => {
        setPendingSessionData({ sessionId, wardrobeNumber: wardrobe, totalAmount });
        setActiveView('test');
      }} />}
      {activeView === 'open' && <OpenPage onNavigateToGuest={(wardrobe, sessionId, totalAmount) => {
        setPendingSessionData({ sessionId, wardrobeNumber: wardrobe, totalAmount });
        setActiveView('test');
      }} />}
      {activeView === 'closed' && <ClosedPage />}
    </div>
  );
};

export default Index;
