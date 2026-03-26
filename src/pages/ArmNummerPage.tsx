import { useState, useCallback } from 'react';
import { Product, OrderItem, FeedbackType } from '@/types/pos';
import { products } from '@/data/products';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';

// Grid layout matching the physical button board
// Each row: [productCode, colSpan]
const gridLayout: { code: string; span: number }[][] = [
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
    { code: '', span: 1 }, { code: '', span: 1 }, { code: 'JAEG', span: 1 }, { code: 'LICO', span: 1 },
    { code: 'BACA', span: 2 }, { code: 'JENE', span: 2 }, { code: 'JUIC', span: 2 },
  ],
  [
    { code: '', span: 1 }, { code: '', span: 1 }, { code: 'SEXT', span: 1 }, { code: 'STFF', span: 1 },
    { code: 'REDB', span: 2 }, { code: 'WINE', span: 2 }, { code: 'SOFT', span: 2 },
  ],
];

const productMap = new Map(products.map((p) => [p.code, p]));

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

      {/* Top bar */}
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

      {/* Product grid matching physical board layout */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {gridLayout.map((row, ri) => (
          <div
            key={ri}
            className="flex-1 flex"
            style={{ minHeight: 0 }}
          >
            {row.map((cell, ci) => {
              if (!cell.code) {
                return <div key={ci} style={{ flex: cell.span }} className="border-[0.5px] border-black/10 bg-card" />;
              }
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              return (
                <button
                  key={ci}
                  onClick={() => addProduct(product)}
                  style={{
                    flex: cell.span,
                    backgroundColor: product.color,
                    color: product.textColor,
                  }}
                  className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 active:shadow-[inset_0_0_0_2px_hsl(var(--destructive)),0_0_12px_hsl(var(--destructive)/0.5)] p-1 min-w-0"
                >
                  <span
                    className="font-extrabold leading-[1.05] text-center uppercase"
                    style={{ fontSize: cell.span === 2 ? 'clamp(0.9rem, 2.8vw, 2rem)' : 'clamp(0.55rem, 1.6vw, 1.1rem)' }}
                  >
                    {product.name}
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
