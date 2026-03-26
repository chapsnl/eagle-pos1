import { useState, useCallback } from 'react';
import { Product, OrderItem, FeedbackType } from '@/types/pos';
import { products, categoryColors } from '@/data/products';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';

export const ArmNummerPage = () => {
  const [armNumber, setArmNumber] = useState('');
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

  const handleSubmit = useCallback(() => {
    if (!armNumber || items.length === 0) return;
    console.log('Arm nummer order:', armNumber, items);
    setFeedback('success');
    setTimeout(() => {
      setFeedback(null);
      setArmNumber('');
      setItems([]);
    }, 2000);
  }, [armNumber, items]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      
      <div className="p-4 bg-card border-b border-border">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
          Arm Nummer
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={armNumber}
          onChange={(e) => setArmNumber(e.target.value)}
          placeholder="Nummer invoeren..."
          className="w-full max-w-xs bg-secondary text-foreground border border-border rounded-lg px-4 py-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => addProduct(product)}
              className={`${categoryColors[product.category]} pos-btn rounded-lg p-2 flex flex-col items-center justify-center min-h-[56px] shadow-md hover:brightness-110 active:brightness-90`}
            >
              <span className="text-[10px] font-extrabold">{product.code}</span>
              <span className="text-xs font-extrabold">€{product.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border-t border-border p-3 flex items-center gap-3">
        <div className="flex-1 text-sm">
          {items.map((i) => (
            <span key={i.product.id} className="mr-2 text-xs font-bold">
              {i.quantity > 1 && `${i.quantity}×`}{i.product.code}
            </span>
          ))}
        </div>
        <span className="text-primary font-extrabold text-lg">€{total.toFixed(2)}</span>
        <button
          onClick={handleSubmit}
          disabled={!armNumber || items.length === 0}
          className="pos-btn bg-primary text-primary-foreground rounded-lg px-6 py-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
        >
          BOEK
        </button>
      </div>
    </div>
  );
};
