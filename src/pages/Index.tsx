import { useState, useCallback } from 'react';
import { Product, OrderItem, FeedbackType, AppView } from '@/types/pos';
import { NavTabs } from '@/components/pos/NavTabs';
import { OrderBar } from '@/components/pos/OrderBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ActionBar } from '@/components/pos/ActionBar';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { GarderobePage } from './GarderobePage';
import { ArmNummerPage } from './ArmNummerPage';
import { AdminPage } from './AdminPage';

const Index = () => {
  const [activeView, setActiveView] = useState<AppView>('bar');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const addProduct = useCallback((product: Product) => {
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
    console.log('PIN payment:', total);
    showFeedback('success');
    setItems([]);
  }, [total, showFeedback]);

  const handleCash = useCallback(() => {
    console.log('Cash payment:', total);
    showFeedback('success');
    setItems([]);
  }, [total, showFeedback]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NavTabs activeView={activeView} onViewChange={setActiveView} />

      {activeView === 'bar' && (
        <>
          <OrderBar items={items} total={total} onRemoveItem={removeItem} onClear={clearOrder} />
          <ProductGrid onAddProduct={addProduct} />
          <ActionBar
            total={total}
            hasItems={items.length > 0}
            onPin={handlePin}
            onCash={handleCash}
            onCorrect={() => console.log('Correct')}
            onIncident={() => console.log('Incident')}
          />
        </>
      )}

      {activeView === 'garderobe' && <GarderobePage />}
      {activeView === 'arm-nummer' && <ArmNummerPage />}
      {activeView === 'admin' && <AdminPage />}
    </div>
  );
};

export default Index;
