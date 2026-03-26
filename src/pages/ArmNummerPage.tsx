import { useState, useCallback } from 'react';
import { Product, OrderItem, FeedbackType } from '@/types/pos';
import { products } from '@/data/products';
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
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <FeedbackOverlay type={feedback} />
      
      {/* Arm nummer input + order summary bar */}
      <div className="bg-card border-b border-border p-2 flex items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          ARM NR
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={armNumber}
          onChange={(e) => setArmNumber(e.target.value)}
          placeholder="..."
          className="w-20 bg-secondary text-foreground border border-border px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
        />
        <div className="flex-1 text-sm overflow-hidden">
          {items.map((i) => (
            <span key={i.product.id} className="mr-2 text-xs font-bold">
              {i.quantity > 1 && `${i.quantity}×`}{i.product.code}
            </span>
          ))}
        </div>
        <span className="text-primary font-extrabold text-lg whitespace-nowrap">€{total.toFixed(2)}</span>
        <button
          onClick={handleSubmit}
          disabled={!armNumber || items.length === 0}
          className="pos-btn px-5 py-2 font-extrabold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 14px #00cc1380' }}
        >
          BOEK
        </button>
      </div>

      {/* Full-screen product grid — no prices, large text */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-7 h-full">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => addProduct(product)}
              style={{ backgroundColor: product.color, color: product.textColor }}
              className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 active:shadow-[inset_0_0_0_2px_hsl(var(--destructive)),0_0_12px_hsl(var(--destructive)/0.5)] p-1"
            >
              <span className="font-extrabold leading-[1.1] text-center uppercase" style={{ fontSize: 'clamp(0.7rem, 2.5vw, 1.6rem)' }}>
                {product.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
