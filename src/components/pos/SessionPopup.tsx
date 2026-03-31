import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
          <div className="overflow-y-auto h-full" style={{ maxHeight: '50vh' }}>
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
          {orderLines.length > 4 && (
            <div
              className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
              style={{ background: 'linear-gradient(to top, hsl(var(--card)), transparent)' }}
            />
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
