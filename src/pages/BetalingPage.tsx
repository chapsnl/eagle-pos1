import { OrderItem } from '@/types/pos';
import { X, Nfc, CreditCard, Banknote, Send } from 'lucide-react';

interface BetalingPageProps {
  items: OrderItem[];
  total: number;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onPin: () => void;
  onCash: () => void;
}

export const BetalingPage = ({
  items,
  total,
  onRemoveItem,
  onClear,
  onPin,
  onCash,
}: BetalingPageProps) => {
  const hasItems = items.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Order overview */}
      <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Bestelling ({items.length} items)
        </h2>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Nfc className="w-16 h-16" style={{ color: '#00cc13', filter: 'drop-shadow(0 0 12px #00cc1360)' }} />
            <span className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
              Scan NFC
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between bg-secondary px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase">
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.product.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    [{item.product.code}]
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasItems && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <span className="text-sm font-bold uppercase tracking-widest">Totaal</span>
            <span className="text-2xl font-extrabold" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-0">
        {/* PIN / CONTANT row */}
        <div className="flex">
          <button
            onClick={onPin}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 border-r border-border"
          >
            <CreditCard className="w-4 h-4" />
            PIN
          </button>
          <button
            onClick={onCash}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
          >
            <Banknote className="w-4 h-4" />
            CONTANT
          </button>
        </div>

        {/* SEND button */}
        <button
          disabled={!hasItems}
          className="pos-btn py-5 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold uppercase"
          style={{
            backgroundColor: '#00cc13',
            color: '#fff',
            boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
          }}
        >
          <Send className="w-6 h-6" />
          SEND
        </button>
      </div>
    </div>
  );
};
