import { useState, useCallback, useRef, useEffect } from 'react';
import { DbOrderItem } from '@/pages/Index';
import { X, Nfc, CreditCard, Banknote, Send } from 'lucide-react';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { useCreateSession, useUpdateSession, useAddDrinkLogs } from '@/hooks/useSessions';
import { scanNfcTag, writeNfcTag } from '@/hooks/useNfc';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';

interface NfcOrderData {
  uid: string;
  items: { shorthand: string; qty: number }[];
  total: number;
  wn?: string;
  source: 'nfc' | 'db';
}

interface BetalingPageProps {
  items: DbOrderItem[];
  total: number;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onPin: () => void;
  onCash: () => void;
}

/** Fetch session + drink_logs from DB by nfc_uid, return aggregated order */
async function fetchDbOrder(nfcUid: string): Promise<{ items: { shorthand: string; qty: number }[]; total: number; wn?: string } | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, total_amount, wardrobe_number')
    .eq('nfc_uid', nfcUid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: logs } = await supabase
    .from('drink_logs')
    .select('product_id, price_at_time, products(shorthand)')
    .eq('session_id', session.id);

  if (!logs || logs.length === 0) return null;

  const agg: Record<string, { qty: number; shorthand: string }> = {};
  for (const log of logs) {
    const sh = (log as any).products?.shorthand || log.product_id;
    if (!agg[sh]) agg[sh] = { qty: 0, shorthand: sh };
    agg[sh].qty++;
  }

  return {
    items: Object.values(agg),
    total: Number(session.total_amount),
    wn: session.wardrobe_number || undefined,
  };
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
  const { data: productsData } = useProducts();

  const [nfcOrderData, setNfcOrderData] = useState<NfcOrderData | null>(null);
  const idleScanningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startIdleScan = useCallback(async () => {
    if (hasItems || idleScanningRef.current) return;
    idleScanningRef.current = true;
    setNfcOrderData(null);

    try {
      const { promise, cancel } = scanNfcTag(120000);
      cancelRef.current = cancel;
      const result = await promise;

      if (!mountedRef.current) return;

      // Always do DB lookup first (source of truth)
      const dbOrder = await fetchDbOrder(result.uid);

      if (dbOrder) {
        // DB has data — use it as source of truth
        setNfcOrderData({ uid: result.uid, ...dbOrder, source: 'db' });

        // Compare with NFC data and update NFC if different
        const nfcSummary = result.message ? (() => {
          try { return JSON.parse(result.message!); } catch { return null; }
        })() : null;

        const dbSummary = dbOrder.items.map(i => `${i.qty}x${i.shorthand}`).join(',');
        const dbPayload = JSON.stringify({
          items: dbSummary,
          total: dbOrder.total,
          ...(dbOrder.wn ? { wn: dbOrder.wn } : {}),
        });

        const nfcNeedsUpdate = !nfcSummary ||
          nfcSummary.items !== dbSummary ||
          nfcSummary.total !== dbOrder.total ||
          (nfcSummary.wn || '') !== (dbOrder.wn || '');

        if (nfcNeedsUpdate) {
          try {
            const { promise: wp, cancel: wc } = writeNfcTag(dbPayload, 10000);
            cancelRef.current = wc;
            await wp;
            console.log('[Pay] NFC updated with DB data');
          } catch {
            console.warn('[Pay] Failed to update NFC with DB data');
          }
        }
      } else if (result.message) {
        // No DB session, fall back to NFC data
        try {
          const json = JSON.parse(result.message);
          if (json.items && typeof json.items === 'string') {
            const parsedItems = json.items.split(',').map((entry: string) => {
              const match = entry.match(/^(\d+)x(.+)$/);
              return match ? { qty: parseInt(match[1]), shorthand: match[2] } : { qty: 1, shorthand: entry };
            });
            setNfcOrderData({ uid: result.uid, items: parsedItems, total: json.total ?? 0, wn: json.wn, source: 'nfc' });
          }
        } catch { /* not JSON */ }
      }
    } catch {
      // timeout or error — will restart via effect
    } finally {
      if (mountedRef.current) {
        idleScanningRef.current = false;
      }
    }
  }, [hasItems]);

  // Auto-start idle scan when no items
  useEffect(() => {
    if (!hasItems && !nfcOrderData && !nfcStatus) {
      startIdleScan();
    }
    return () => {
      cancelRef.current?.();
      idleScanningRef.current = false;
    };
  }, [hasItems, nfcOrderData, nfcStatus, startIdleScan]);

  // Restart idle scan when nfcOrderData is cleared
  useEffect(() => {
    if (!hasItems && !nfcOrderData && !nfcStatus && !idleScanningRef.current) {
      const t = setTimeout(() => startIdleScan(), 300);
      return () => clearTimeout(t);
    }
  }, [hasItems, nfcOrderData, nfcStatus, startIdleScan]);

  const processPayment = useCallback(async (method: 'pin' | 'cash') => {
    if (!hasItems) return;
    setPaymentMethod(method);

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

        {items.length === 0 && !nfcOrderData ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[nfcPulse_3s_ease-in-out_infinite]">
            <span className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
              Scan NFC
            </span>
            <Nfc className="w-32 h-32" style={{ color: '#00cc13', filter: 'drop-shadow(0 0 20px #00cc1360)' }} />
          </div>
        ) : items.length === 0 && nfcOrderData ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-card border rounded-lg p-5 text-left max-w-sm w-full" style={{ borderColor: '#00cc1340' }}>
              <p className="text-xs font-mono mb-3 break-all" style={{ color: '#00cc13' }}>UID: {nfcOrderData.uid}</p>
              {nfcOrderData.source === 'db' && (
                <p className="text-xs text-muted-foreground mb-2">📊 Data uit database</p>
              )}
              <div className="space-y-2">
                {nfcOrderData.items.map((item, i) => {
                  const product = productsData?.find(p => p.shorthand === item.shorthand);
                  return (
                    <div key={i} className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">{product?.full_name || item.shorthand}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{item.qty}x</span>
                        <span style={{ color: '#00cc13' }}>€{((product?.price ?? 0) * item.qty).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                <span className="font-extrabold uppercase" style={{ fontSize: '1rem' }}>Totaal</span>
                <span className="font-extrabold text-xl" style={{ color: '#00cc13' }}>€{Number(nfcOrderData.total).toFixed(2)}</span>
              </div>
              {nfcOrderData.wn && (
                <div className="border-t border-border mt-3 pt-3 space-y-1">
                  {nfcOrderData.wn.match(/C(\d+)/)?.[1] && (
                    <div className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">Jasnummer</span>
                      <span style={{ color: '#00cc13' }}>{nfcOrderData.wn.match(/C(\d+)/)![1]}</span>
                    </div>
                  )}
                  {nfcOrderData.wn.match(/B(\d+)/)?.[1] && (
                    <div className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">Tasnummer</span>
                      <span style={{ color: '#00cc13' }}>{nfcOrderData.wn.match(/B(\d+)/)![1]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => { setNfcOrderData(null); }}
              className="mt-4 px-6 py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380' }}
            >
              Volgende Scan
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase" style={{ fontSize: '1rem' }}>
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.product.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground">[{item.product.shorthand}]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold" style={{ color: '#00cc13', fontSize: '1rem' }}>
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
            <span className="font-bold uppercase tracking-widest" style={{ fontSize: '1rem' }}>Totaal</span>
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
