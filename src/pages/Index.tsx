import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { DbProduct } from '@/hooks/useProducts';
import { FeedbackType, AppView } from '@/types/pos';

import { NavTabs } from '@/components/pos/NavTabs';
import { OrderBar } from '@/components/pos/OrderBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { AdminPage } from './AdminPage';
import { OpenPage } from './OpenPage';
import { ClosedPage } from './ClosedPage';
import { TestPage, TestPageHandle } from './TestPage';
import { Send, AlertCircle } from 'lucide-react';
import { NumPad } from '@/components/pos/NumPad';
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





type BarPhase = 'input-number' | 'products';

const Index = () => {
  const [activeView, setActiveView] = useState<AppView>('open');
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [pendingGuestNumber, setPendingGuestNumber] = useState<string | null>(null);
  const [pendingSessionData, setPendingSessionData] = useState<{ sessionId: string; wardrobeNumber: string; totalAmount: number } | null>(null);

  // Bar number entry state
  const [barPhase, setBarPhase] = useState<BarPhase>('input-number');
  const [barNumber, setBarNumber] = useState('');
  const [barSessionId, setBarSessionId] = useState<string | null>(null);
  const [barSessionTotal, setBarSessionTotal] = useState(0);
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

  const autoCreateAndOpen = useCallback(async (wardrobeNum: string) => {
    try {
      const session = await createSession.mutateAsync({
        wardrobe_number: wardrobeNum,
        is_event_numbered: true,
      });
      await lockSession(session.id);
      setBarSessionId(session.id);
      setBarSessionTotal(Number(session.total_amount ?? 0));
      setBarPhase('products');
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [createSession, lockSession]);

  const resolveSessionByWardrobe = useCallback(async (wardrobeNum: string) => {
    try {
      const session = await findActiveSessionByWardrobe.mutateAsync(wardrobeNum);
      if (!session) {
        await autoCreateAndOpen(wardrobeNum);
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
  }, [findActiveSessionByWardrobe, deviceId, lockSession, autoCreateAndOpen]);

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
      void resolveSessionByWardrobe(wardrobe);
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

    // Capture everything needed for the writes BEFORE clearing state
    const sessionId = barSessionId;
    const newTotal = barSessionTotal + total;
    const logs = items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        session_id: sessionId,
        product_id: item.product.id,
        price_at_time: item.product.price,
      }))
    );

    broadcastOrder({
      guestNumber: barNumber,
      sessionId,
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.full_name,
        shorthand: i.product.shorthand,
        price: i.product.price,
        quantity: i.quantity,
      })),
      totalAmount: newTotal,
      timestamp: Date.now(),
    });

    // Reset UI immediately — do not wait for network
    setItems([]);
    setBarNumber('');
    setBarSessionId(null);
    setBarSessionTotal(0);
    setBarPhase('input-number');
    lastLookupRef.current = null;
    clearOrder();

    // Write to Supabase in background — staff can already serve next customer
    (async () => {
      try {
        await addDrinkLogs.mutateAsync(logs);
        await updateSession.mutateAsync({ id: sessionId, total_amount: newTotal });
        await unlockSession(sessionId);
      } catch {
        toast.error('Opslaan mislukt — probeer opnieuw');
      }
    })();
  }, [items, barSessionId, barSessionTotal, total, barNumber, addDrinkLogs, updateSession, unlockSession]);

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

  const handleBarNext = useCallback(() => {
    const sid = barSessionId;
    setItems([]);
    setBarNumber('');
    setBarSessionId(null);
    setBarSessionTotal(0);
    setBarPhase('input-number');
    setBarRetourMode(false);
    lastLookupRef.current = null;
    clearOrder();
    if (sid) unlockSession(sid).catch(() => {});
  }, [barSessionId, unlockSession]);

  // 20s inactivity timer
  const anyBarPopupOpen = showBarPayDialog || showBarLockedWarning;
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

  const handleNavigateToOpen = useCallback(async () => {
    // Clean up current session state before navigating back to open
    if (barSessionId) await unlockSession(barSessionId);
    setItems([]);
    setBarNumber('');
    setBarSessionId(null);
    setBarSessionTotal(0);
    setBarPhase('input-number');
    setBarRetourMode(false);
    lastLookupRef.current = null;
    clearOrder();
    setPendingGuestNumber(null);
    setPendingSessionData(null);
    setActiveView('open');
  }, [barSessionId, unlockSession]);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
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
              <NumPad onKey={handleNumKey} />
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

      {activeView === 'test' && <TestPage initialGuestNumber={pendingGuestNumber} initialSessionData={pendingSessionData} onGuestNumberConsumed={() => { setPendingGuestNumber(null); setPendingSessionData(null); }} onNavigateToOpen={handleNavigateToOpen} />}
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
