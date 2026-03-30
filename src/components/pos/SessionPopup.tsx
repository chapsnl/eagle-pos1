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
  orderLines: OrderLine[];
  showTotal?: boolean;
  showPrices?: boolean;
  totalAmount?: number;
  actions?: SessionPopupAction[];
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
}: SessionPopupProps) => {
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
            <p className="font-bold" style={{ color: '#888', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)' }}>
              {subtitle}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-2" style={{ maxHeight: '50vh' }}>
          {orderLines.length === 0 ? (
            <p className="text-center py-4" style={{ color: '#666', fontSize: '1.25rem' }}>
              Geen bestellingen
            </p>
          ) : (
            <div className="space-y-1">
              {orderLines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-center px-3 py-3 font-bold"
                  style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '8px',
                    fontSize: showPrices ? 'clamp(0.85rem, 1.8vw, 1.1rem)' : 'clamp(1.1rem, 2.5vw, 1.6rem)',
                  }}
                >
                  <span style={{ color: '#e5e5e5' }}>
                    {line.qty}× {line.name}
                    {showPrices && (
                      <span style={{ color: '#888' }}> – €{line.price.toFixed(2)} (€{(line.qty * line.price).toFixed(2)})</span>
                    )}
                  </span>
                </div>
              ))}
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
