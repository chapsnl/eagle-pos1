import { useState, useCallback, useRef } from 'react';
import { DbOrderItem } from '@/pages/Index';
import { X, Nfc, CreditCard, Banknote, Send } from 'lucide-react';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { useCreateSession, useUpdateSession, useAddDrinkLogs } from '@/hooks/useSessions';
import { scanNfcTag } from '@/hooks/useNfc';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';

interface BetalingPageProps {
  items: DbOrderItem[];
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
  const [nfcStatus, setNfcStatus] = useState<'scanning' | 'writing' | null>(null);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pin' | 'cash' | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();

  const processPayment = useCallback(async (method: 'pin' | 'cash') => {
    if (!hasItems) return;
    setPaymentMethod(method);

    // Start NFC scan
    setNfcStatus('scanning');
    const { promise, cancel } = scanNfcTag(30000);
    cancelRef.current = cancel;

    let nfcUid: string | undefined;
    try {
      const result = await promise;
      nfcUid = result.uid;
      setNfcStatus(null);
    } catch (err: any) {
      setNfcStatus(null);
      if (err.message === 'NFC_CANCELLED') return;
      // Timeout — proceed without NFC
    }

    try {
      const session = await createSession.mutateAsync({ nfc_uid: nfcUid });
      const logs = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          session_id: session.id,
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );
      await addDrinkLogs.mutateAsync(logs);
      await updateSession.mutateAsync({
        id: session.id,
        total_amount: total,
        actual_paid_amount: total,
        status: 'paid',
      });
      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        if (method === 'pin') onPin();
        else onCash();
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [hasItems, items, total, createSession, updateSession, addDrinkLogs, onPin, onCash]);

  const handleCancelNfc = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NfcOverlay status={nfcStatus} onCancel={handleCancelNfc} />

      <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Bestelling ({items.length} items)
        </h2>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[nfcPulse_3s_ease-in-out_infinite]">
            <span className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
              Scan NFC
            </span>
            <Nfc className="w-32 h-32" style={{ color: '#00cc13', filter: 'drop-shadow(0 0 20px #00cc1360)' }} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase">
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.product.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground">[{item.product.shorthand}]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                  <button onClick={() => onRemoveItem(item.product.id)} className="text-muted-foreground hover:text-destructive">
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

      <div className="flex flex-col gap-0">
        <div className="flex">
          <button
            onClick={() => processPayment('pin')}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 border-r border-border"
          >
            <CreditCard className="w-4 h-4" /> PIN
          </button>
          <button
            onClick={() => processPayment('cash')}
            disabled={!hasItems}
            className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
          >
            <Banknote className="w-4 h-4" /> CONTANT
          </button>
        </div>
        <button
          onClick={() => processPayment('pin')}
          disabled={!hasItems}
          className="pos-btn py-5 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold uppercase"
          style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}
        >
          <Send className="w-6 h-6" /> SEND
        </button>
      </div>
    </div>
  );
};
