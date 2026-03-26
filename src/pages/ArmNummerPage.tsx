import { useState, useCallback } from 'react';
import { Product, OrderItem, FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Nfc } from 'lucide-react';

// Grid layout matching the physical register photo exactly
// Each cell: [code, name, color, textColor, colSpan?]
type CellDef =
  | { type: 'product'; code: string; name: string; price: number; color: string; textColor: string; colSpan?: number; rowSpan?: number }
  | { type: 'numpad'; label: string; action: string; color: string; textColor: string; colSpan?: number; rowSpan?: number }
  | { type: 'fn'; label: string; action: string; color: string; textColor: string; colSpan?: number; rowSpan?: number }
  | { type: 'empty'; colSpan?: number; rowSpan?: number };

const d = '#12100e';
const w = '#e4e2e2';
const y = '#f4b738';
const r = '#ef5931';
const pk = '#bb706b';
const gr = '#aacd6c';
const bl = '#294c4e';
const bm = '#8f8255';

const gridRows: CellDef[][] = [
  // Row 1
  [
    { type: 'product', code: '1', name: '1', price: 0.01, color: w, textColor: d },
    { type: 'product', code: 'DIV9', name: 'DIV\n9%', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'SHO', name: 'SHOT\n4,00', price: 4.00, color: gr, textColor: d },
    { type: 'product', code: 'BAIL', name: 'BAILEYS', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'JAME', name: 'JAMESON', price: 3.00, color: r, textColor: '#fff' },
    { type: 'product', code: 'ABSO', name: 'ABSOLUT', price: 6.00, color: pk, textColor: d },
    { type: 'product', code: 'HEIN', name: 'HEINEKEN', price: 5.50, color: y, textColor: d },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'fn', label: 'CLEAR', action: 'clear', color: '#9ed36a', textColor: d },
    { type: 'fn', label: 'X', action: 'backspace', color: '#ff3333', textColor: '#fff' },
  ],
  // Row 2
  [
    { type: 'product', code: '20', name: '20', price: 20.00, color: w, textColor: d },
    { type: 'product', code: '18', name: '18', price: 18.00, color: w, textColor: d },
    { type: 'product', code: 'TTOP', name: 'TANK\nTOP\n20,00', price: 20.00, color: w, textColor: d },
    { type: 'product', code: 'MALI', name: 'MALIBU', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'JACD', name: 'JACK\nDANIELS', price: 3.00, color: r, textColor: '#fff' },
    { type: 'product', code: 'BOMB', name: 'BOMBAY', price: 3.00, color: bm, textColor: d },
    { type: 'product', code: 'GROL', name: 'GROLSCH', price: 6.50, color: y, textColor: d },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' },
  ],
  // Row 3
  [
    { type: 'product', code: '7', name: '7', price: 7.00, color: w, textColor: d },
    { type: 'product', code: '12.5', name: '12,5', price: 12.50, color: w, textColor: d },
    { type: 'product', code: 'AMAR', name: 'AMA\nRETTO', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'TEQU', name: 'TEQUILA', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'JIMB', name: 'JIM\nBEAM', price: 3.00, color: r, textColor: '#fff' },
    { type: 'product', code: 'APPC', name: 'APPLE\nCIDER', price: 3.00, color: pk, textColor: d },
    { type: 'product', code: 'COAF', name: 'CORONA\nAFFLIGEM', price: 3.00, color: y, textColor: d },
    { type: 'empty' },
    { type: 'numpad', label: '7', action: '7', color: w, textColor: d },
    { type: 'numpad', label: '8', action: '8', color: w, textColor: d },
    { type: 'numpad', label: '9', action: '9', color: w, textColor: d },
  ],
  // Row 4
  [
    { type: 'product', code: '8', name: '8', price: 8.00, color: w, textColor: d },
    { type: 'product', code: '10', name: '10', price: 10.00, color: w, textColor: d },
    { type: 'product', code: 'TSHI', name: 'T-SHIRT\n17,50', price: 17.50, color: w, textColor: d },
    { type: 'product', code: 'SAMB', name: 'SAM\nBUCA', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'BSPI', name: 'BLACK\nSPICED', price: 3.00, color: gr, textColor: d },
    { type: 'product', code: 'WHIB', name: 'WHITE\nBEER', price: 3.00, color: pk, textColor: d },
    { type: 'product', code: 'HE0%', name: 'HEINEKEN\n0,0%', price: 3.00, color: y, textColor: d },
    { type: 'empty' },
    { type: 'numpad', label: '4', action: '4', color: w, textColor: d },
    { type: 'numpad', label: '5', action: '5', color: w, textColor: d },
    { type: 'numpad', label: '6', action: '6', color: w, textColor: d },
  ],
  // Row 5
  [
    { type: 'fn', label: 'COAT', action: 'coat', color: r, textColor: '#fff' },
    { type: 'product', code: 'JAEG', name: 'JÄGER\nMEISTER', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'LICO', name: 'LICOR\n43', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'BACA', name: 'BACARDI', price: 3.00, color: gr, textColor: d },
    { type: 'product', code: 'JENE', name: 'BINNEN\nJENEVER', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'JUIC', name: 'JUICES', price: 4.50, color: y, textColor: d },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'numpad', label: '1', action: '1', color: w, textColor: d },
    { type: 'numpad', label: '2', action: '2', color: w, textColor: d },
    { type: 'numpad', label: '3', action: '3', color: w, textColor: d },
  ],
  // Row 6
  [
    { type: 'fn', label: 'BAG', action: 'bag', color: bl, textColor: '#fff' },
    { type: 'product', code: 'SEXT', name: 'SEX\nTOYS', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'STFF', name: 'STAFF\n(2,50)', price: 2.00, color: w, textColor: d },
    { type: 'product', code: 'REDB', name: 'REDBULL', price: 3.00, color: bl, textColor: '#fff' },
    { type: 'product', code: 'WINE', name: 'MARTINI\nWINE', price: 3.00, color: w, textColor: d },
    { type: 'product', code: 'SOFT', name: 'SOFT\nDRINKS', price: 4.00, color: bl, textColor: '#fff' },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'numpad', label: '0', action: '0', color: w, textColor: d },
    { type: 'numpad', label: '00', action: '00', color: w, textColor: d },
    { type: 'fn', label: 'ENTER', action: 'enter', color: '#ff3333', textColor: '#fff' },
  ],
];

export const ArmNummerPage = () => {
  const [armNumber, setArmNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const addProduct = useCallback((code: string, name: string, price: number, color: string, textColor: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.code === code);
      if (existing) return prev.map((i) => i.product.code === code ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: { id: code, code, name: name.replace(/\n/g, ' '), price, color, textColor }, quantity: 1 }];
    });
  }, []);

  const handleNumpad = useCallback((action: string) => {
    setArmNumber((prev) => prev + action);
  }, []);

  const handleFn = useCallback((action: string) => {
    if (action === 'clear') {
      setArmNumber('');
      setItems([]);
    } else if (action === 'backspace') {
      setArmNumber((prev) => prev.slice(0, -1));
    } else if (action === 'enter') {
      if (!armNumber || items.length === 0) return;
      console.log('Arm nummer order:', armNumber, items);
      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        setArmNumber('');
        setItems([]);
      }, 2000);
    }
  }, [armNumber, items]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />

      {/* Display bar */}
      <div className="bg-card border-b border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ARM NR:</span>
          <span className="text-xl font-extrabold text-primary min-w-[60px]">
            {armNumber || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {items.map((i) => (
            <span key={i.product.code} className="text-[10px] font-bold text-muted-foreground">
              {i.quantity > 1 && `${i.quantity}×`}{i.product.code}
            </span>
          ))}
          {items.length > 0 && (
            <span className="text-sm font-extrabold text-primary ml-2">€{total.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Register grid */}
      <div className="flex-1 grid grid-rows-6 overflow-hidden">
        {gridRows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-11">
            {row.map((cell, colIdx) => {
              if (cell.type === 'empty') {
                return <div key={colIdx} className="bg-card border-[0.5px] border-black/10" />;
              }
              if (cell.type === 'product') {
                return (
                  <button
                    key={colIdx}
                    onClick={() => addProduct(cell.code, cell.name, cell.price, cell.color, cell.textColor)}
                    style={{ backgroundColor: cell.color, color: cell.textColor }}
                    className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 active:shadow-[inset_0_0_0_2px_hsl(var(--destructive)),0_0_12px_hsl(var(--destructive)/0.5)] p-0.5"
                  >
                    <span className="text-[clamp(0.5rem,1.8vw,0.75rem)] font-extrabold leading-[1.15] text-center whitespace-pre-line uppercase">
                      {cell.name}
                    </span>
                  </button>
                );
              }
              if (cell.type === 'numpad') {
                return (
                  <button
                    key={colIdx}
                    onClick={() => handleNumpad(cell.action)}
                    style={{ backgroundColor: cell.color, color: cell.textColor }}
                    className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 text-[clamp(1rem,3vw,1.8rem)] font-extrabold"
                  >
                    {cell.label}
                  </button>
                );
              }
              // fn
              return (
                <button
                  key={colIdx}
                  onClick={() => handleFn(cell.action)}
                  style={{ backgroundColor: cell.color, color: cell.textColor }}
                  className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-75 text-[clamp(0.5rem,1.6vw,0.75rem)] font-extrabold"
                >
                  {cell.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Send bar */}
      <button
        onClick={() => handleFn('enter')}
        disabled={!armNumber || items.length === 0}
        className="pos-btn py-3 text-lg flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-75"
        style={{ backgroundColor: '#00cc13', color: '#ffffff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}
      >
        <Nfc className="w-5 h-5" />
        SEND — €{total.toFixed(2)}
      </button>
    </div>
  );
};
