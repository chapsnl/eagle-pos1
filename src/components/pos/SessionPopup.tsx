import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChevronDown } from 'lucide-react';

export interface OrderLine {
  name: string;
  qty: number;
  price: number;
}

export interface SessionPopupAction {
  label: string;
  onClick: () => void;
  variant: 'confirm' | 'cancel';
}

interface SessionPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  subtitleSize?: string;
  orderLines: OrderLine[];
  showTotal?: boolean;
  showPrices?: boolean;
  totalAmount?: number;
  actions?: SessionPopupAction[];
  showItemCount?: boolean;
}

const SessionPopup = ({
  open,
  onClose,
  title,
  subtitle,
  orderLines,
  showTotal = false,
  showPrices = false,
  totalAmount = 0,
  actions = [],
  subtitleSize,
  showItemCount = false,
}: SessionPopupProps) => {
  const totalItemCount = orderLines.reduce((sum, line) => sum + line.qty, 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) { setCanScrollDown(false); return; }
    setCanScrollDown(el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const t = setTimeout(checkScroll, 50);
    return () => clearTimeout(t);
  }, [orderLines, open, checkScroll]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="bg-card max-h-[80vh] flex flex-col"
        style={{ borderColor: '#00cc1340', borderRadius: '12px' }}
      >
        <DialogHeader>
          <DialogTitle
            className="font-extrabold uppercase text-lg"
            style={{ color: '#00cc13' }}
          >
            {title}
          </DialogTitle>
          {subtitle && (
            <div className="flex justify-between items-center">
              <p className="font-bold" style={{ color: '#888', fontSize: subtitleSize || 'clamp(1.1rem, 2.5vw, 1.5rem)' }}>
                {subtitle}
              </p>
              {showItemCount && totalItemCount > 0 && (
                <span className="font-semibold" style={{ color: '#666', fontSize: 'clamp(0.8rem, 1.5vw, 1rem)' }}>
                  {totalItemCount} items
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="relative my-2" style={{ maxHeight: '50vh' }}>
          <div
            ref={scrollRef}
            className="overflow-y-auto h-full"
            style={{ maxHeight: '50vh' }}
            onScroll={checkScroll}
          >
            {orderLines.length === 0 ? (
              <p className="text-center py-4" style={{ color: '#666', fontSize: '1.25rem' }}>
                Geen bestellingen
              </p>
            ) : (
              <div className="space-y-1">
                {orderLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 font-bold"
                    style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      fontSize: showPrices ? 'clamp(0.75rem, 1.5vw, 0.95rem)' : 'clamp(0.9rem, 2vw, 1.3rem)',
                    }}
                  >
                    <span style={{ color: '#e5e5e5' }}>
                      {line.qty}× {line.name}
                    </span>
                    {showPrices && (
                      <span style={{ color: '#888' }}>€{line.price.toFixed(2)} (€{(line.qty * line.price).toFixed(2)})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {canScrollDown && (
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 pointer-events-none"
              style={{
                bottom: '8px',
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderRadius: '999px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              <ChevronDown size={14} style={{ color: '#00cc13' }} />
              <span className="text-xs font-bold" style={{ color: '#00cc13' }}>Meer</span>
            </div>
          )}
        </div>

        {showTotal && (
          <div
            className="flex justify-between font-extrabold text-base mt-3 pt-2"
            style={{ borderTop: '1px solid #333' }}
          >
            <span style={{ color: '#00cc13' }}>TOTAAL</span>
            <span style={{ color: '#00cc13' }}>€{totalAmount.toFixed(2)}</span>
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex gap-3 mt-2">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className="flex-1 py-3 font-extrabold uppercase text-sm"
                style={{
                  backgroundColor: action.variant === 'cancel' ? '#ef4444' : '#00cc13',
                  color: '#fff',
                  borderRadius: '6px',
                  boxShadow: action.variant === 'cancel'
                    ? '0 0 12px #ef444480'
                    : '0 0 12px #00cc1380',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { SessionPopup };
