import { OrderItem } from '@/types/pos';
import { X, Nfc, CreditCard, Banknote, AlertTriangle, RotateCcw } from 'lucide-react';

interface BetalingPageProps {
  items: OrderItem[];
  total: number;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onPin: () => void;
  onCash: () => void;
  onCorrect: () => void;
  onIncident: () => void;
}

export const BetalingPage = ({
  items,
  total,
  onRemoveItem,
  onClear,
  onPin,
  onCash,
  onCorrect,
  onIncident,
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
          <div className="flex-1 flex items-center justify-center">
            <span className="text-muted-foreground text-sm uppercase tracking-widest">
              Geen selectie
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
                  <span className="text-sm font-extrabold text-primary">
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
            <span className="text-2xl font-extrabold text-primary">€{total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="bg-card border-t border-border flex flex-col gap-0">
        {/* SEND - prominent */}
        <button
          disabled={!hasItems}
          className="pos-btn bg-primary text-primary-foreground py-5 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
        >
          <Nfc className="w-6 h-6" />
          SEND
        </button>

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

        {/* CORRIGEER / INCIDENT / WISSEN row */}
        <div className="flex">
          <button
            onClick={onCorrect}
            className="pos-btn flex-1 bg-muted text-muted-foreground py-2.5 text-[10px] flex items-center justify-center gap-1 hover:brightness-110 border-r border-border"
          >
            <RotateCcw className="w-3 h-3" />
            CORRIGEER
          </button>
          <button
            onClick={onIncident}
            className="pos-btn flex-1 bg-destructive text-destructive-foreground py-2.5 text-[10px] flex items-center justify-center gap-1 hover:brightness-110 border-r border-border"
          >
            <AlertTriangle className="w-3 h-3" />
            INCIDENT
          </button>
          <button
            onClick={onClear}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-muted text-muted-foreground py-2.5 text-[10px] flex items-center justify-center gap-1 hover:brightness-110 disabled:opacity-30"
          >
            <X className="w-3 h-3" />
            WISSEN
          </button>
        </div>
      </div>
    </div>
  );
};
