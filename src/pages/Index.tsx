import { useState, useCallback, useRef } from 'react';
import { DbProduct } from '@/hooks/useProducts';
import { FeedbackType, AppView } from '@/types/pos';
import { NavTabs } from '@/components/pos/NavTabs';
import { OrderBar } from '@/components/pos/OrderBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { NfcHiddenInput } from '@/components/pos/NfcHiddenInput';
import { GarderobePage } from './GarderobePage';
import { BetalingPage } from './BetalingPage';
import { ArmNummerPage } from './ArmNummerPage';
import { AdminPage } from './AdminPage';
import { Send } from 'lucide-react';
import { useCreateSession, useAddDrinkLogs, useUpdateSession } from '@/hooks/useSessions';
import { waitForNfcScan } from '@/hooks/useNfc';

export interface DbOrderItem {
  product: DbProduct;
  quantity: number;
}

const Index = () => {
  const [activeView, setActiveView] = useState<AppView>('bar');
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [nfcStatus, setNfcStatus] = useState<'scanning' | null>(null);
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

    const completeOrder = async (nfcUid?: string) => {
      try {
        const session = await createSession.mutateAsync({ nfc_uid: nfcUid });
        const logs = items.flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            session_id: session.id,
            product_id: item.product.id,
            price_at_time: item.product.price,
          }))
        );
        await addDrinkLogs.mutateAsync(logs);
        await updateSession.mutateAsync({
          id: session.id,
          total_amount: session.total_amount + total,
        });
        showFeedback('success');
        setItems([]);
      } catch {
        showFeedback('error');
      }
    };

    // Start NFC scan
    setNfcStatus('scanning');
    const { promise, cancel } = waitForNfcScan(30000);
    cancelRef.current = cancel;

    try {
      const result = await promise;
      setNfcStatus(null);
      await completeOrder(result.uid);
    } catch (err: any) {
      setNfcStatus(null);
      if (err.message !== 'NFC_CANCELLED') {
        // Timeout — save without NFC
        await completeOrder();
      }
    }
  }, [items, total, createSession, addDrinkLogs, updateSession, showFeedback]);

  const handleCancelNfc = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NfcOverlay status={nfcStatus} onCancel={handleCancelNfc} />
      <NavTabs activeView={activeView} onViewChange={setActiveView} itemCount={items.length} />

      {activeView === 'bar' && (
        <>
          <OrderBar items={items} total={total} onRemoveItem={removeItem} onClear={clearOrder} />
          <ProductGrid onAddProduct={addProduct} />
          <button
            onClick={handleSend}
            disabled={items.length === 0}
            className="pos-btn py-4 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-75"
            style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20' }}
          >
            <Send className="w-6 h-6" />
            SEND — €{total.toFixed(2)}
          </button>
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
