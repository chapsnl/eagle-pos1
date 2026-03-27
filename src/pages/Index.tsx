import { useState, useCallback, useRef } from 'react';
import { DbProduct } from '@/hooks/useProducts';
import { FeedbackType, AppView } from '@/types/pos';
import { NavTabs } from '@/components/pos/NavTabs';
import { OrderBar } from '@/components/pos/OrderBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { GarderobePage } from './GarderobePage';
import { BetalingPage } from './BetalingPage';
import { ArmNummerPage } from './ArmNummerPage';
import { AdminPage } from './AdminPage';
import { Send } from 'lucide-react';
import { useCreateSession, useAddDrinkLogs, useUpdateSession } from '@/hooks/useSessions';
import { scanNfcTag, scanAndWriteNfcTag } from '@/hooks/useNfc';
import { supabase } from '@/integrations/supabase/client';

export interface DbOrderItem {
  product: DbProduct;
  quantity: number;
}

const Index = () => {
  const [activeView, setActiveView] = useState<AppView>('bar');
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [nfcStatus, setNfcStatus] = useState<'scanning' | 'writing' | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const createSession = useCreateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const updateSession = useUpdateSession();

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

  const clearOrder = useCallback(() => setItems([]), []);

  const showFeedback = useCallback((type: FeedbackType) => {
    setFeedback(type);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  const handlePin = useCallback(() => {
    showFeedback('success');
    setItems([]);
  }, [showFeedback]);

  const handleCash = useCallback(() => {
    showFeedback('success');
    setItems([]);
  }, [showFeedback]);

  const handleSend = useCallback(async () => {
    if (items.length === 0) return;

    setNfcStatus('scanning');

    const { promise, cancel } = scanAndWriteNfcTag(
      async (result) => {
        const nfcUid = result.uid;
        let tagWardrobeNumber: string | undefined;

        // Extract wardrobe number from NFC tag data
        if (result.message) {
          try {
            const json = JSON.parse(result.message);
            if (json.wn) tagWardrobeNumber = json.wn;
          } catch { /* not JSON */ }
        }

        // Create or find session in DB
        const session = await createSession.mutateAsync({
          nfc_uid: nfcUid,
          lookup_wardrobe: tagWardrobeNumber,
        });
        const logs = items.flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            session_id: session.id,
            product_id: item.product.id,
            price_at_time: item.product.price,
          }))
        );
        await addDrinkLogs.mutateAsync(logs);
        const newTotal = session.total_amount + total;
        await updateSession.mutateAsync({
          id: session.id,
          total_amount: newTotal,
        });

        // Build cumulative NFC payload from DB
        const { data: allLogs } = await supabase
          .from('drink_logs')
          .select('product_id, products(shorthand)')
          .eq('session_id', session.id);

        const agg: Record<string, { qty: number; shorthand: string }> = {};
        for (const log of allLogs || []) {
          const sh = (log as any).products?.shorthand || log.product_id;
          if (!agg[sh]) agg[sh] = { qty: 0, shorthand: sh };
          agg[sh].qty++;
        }

        const { data: freshSession } = await supabase
          .from('sessions')
          .select('wardrobe_number')
          .eq('id', session.id)
          .single();

        const orderSummary = Object.values(agg).map(a => `${a.qty}x${a.shorthand}`).join(',');
        return JSON.stringify({
          items: orderSummary,
          total: newTotal,
          ...(freshSession?.wardrobe_number ? { wn: freshSession.wardrobe_number } : {}),
        });
      },
      30000,
      (status) => setNfcStatus(status),
    );
    cancelRef.current = cancel;

    try {
      await promise;
      setNfcStatus(null);
      showFeedback('success');
      setItems([]);
    } catch {
      setNfcStatus(null);
      showFeedback('error');
    }
  }, [items, total, createSession, addDrinkLogs, updateSession, showFeedback]);

  const handleCancelNfc = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NfcOverlay status={nfcStatus} onCancel={handleCancelNfc} />
      <NavTabs activeView={activeView} onViewChange={setActiveView} itemCount={items.length} />

      {activeView === 'bar' && (
        <>
          <OrderBar items={items} total={total} onRemoveItem={removeItem} onClear={clearOrder} />
          <ProductGrid onAddProduct={addProduct} />
          <div className="pb-[max(0px,env(safe-area-inset-bottom))]">
            <button
              onClick={handleSend}
              disabled={items.length === 0}
              className="pos-btn w-full py-3 text-lg flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-75"
              style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20' }}
            >
              <Send className="w-5 h-5" />
              SEND — €{total.toFixed(2)}
            </button>
          </div>
        </>
      )}

      {activeView === 'garderobe' && <GarderobePage />}

      {activeView === 'betaling' && (
        <BetalingPage
          items={items}
          total={total}
          onRemoveItem={removeItem}
          onClear={clearOrder}
          onPin={handlePin}
          onCash={handleCash}
        />
      )}

      {activeView === 'arm-nummer' && <ArmNummerPage />}
      {activeView === 'admin' && <AdminPage />}
    </div>
  );
};

export default Index;
