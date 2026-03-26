import { DbOrderItem } from '@/pages/Index';
import { X } from 'lucide-react';

interface OrderBarProps {
  items: DbOrderItem[];
  total: number;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
}

export const OrderBar = ({ items, total, onRemoveItem, onClear }: OrderBarProps) => {
  if (items.length === 0) {
    return (
      <div className="h-14 bg-card border-b border-border flex items-center px-4">
        <span className="text-muted-foreground text-sm uppercase tracking-widest">Geen selectie</span>
      </div>
    );
  }

  return (
    <div className="min-h-14 bg-card border-b border-border flex items-center px-3 gap-2 animate-slide-down">
      <div className="flex-1 flex items-center gap-2 overflow-x-auto py-2">
        {items.map((item) => (
          <button
            key={item.product.id}
            onClick={() => onRemoveItem(item.product.id)}
            className="flex items-center gap-1.5 bg-secondary rounded-md px-2.5 py-1.5 text-xs font-bold uppercase shrink-0 hover:bg-destructive/20 transition-colors group"
          >
            <span>{item.quantity > 1 && `${item.quantity}×`}{item.product.shorthand}</span>
            <X className="w-3 h-3 opacity-40 group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-primary font-extrabold text-lg">€{total.toFixed(2)}</span>
        <button onClick={onClear} className="pos-btn text-xs text-muted-foreground hover:text-destructive px-2 py-1">
          WISSEN
        </button>
      </div>
    </div>
  );
};
