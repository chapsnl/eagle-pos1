import { useState, useCallback, useRef, useEffect } from 'react';
import { DbOrderItem } from '@/pages/Index';
import { X, Nfc, CreditCard, Banknote, Send, Hash } from 'lucide-react';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { useCreateSession, useUpdateSession, useAddDrinkLogs, useFindActiveSessionByWardrobe } from '@/hooks/useSessions';
import { scanNfcTag, writeNfcTag, eraseNfcTag } from '@/hooks/useNfc';
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

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

/** Fetch session + drink_logs from DB by nfc_uid, return aggregated order */
async function fetchDbOrder(nfcUid: string): Promise<{ sessionId: string; items: { shorthand: string; qty: number }[]; total: number; wn?: string } | null> {
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
    sessionId: session.id,
    items: Object.values(agg),
    total: Number(session.total_amount),
    wn: session.wardrobe_number || undefined,
  };
}

async function fetchDbOrderByWardrobe(wardrobeNumber: string): Promise<{ sessionId: string; items: { shorthand: string; qty: number }[]; total: number; wn?: string } | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, total_amount, wardrobe_number, nfc_uid')
    .eq('wardrobe_number', wardrobeNumber)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: logs } = await supabase
    .from('drink_logs')
    .select('product_id, price_at_time, products(shorthand)')
    .eq('session_id', session.id);

  const agg: Record<string, { qty: number; shorthand: string }> = {};
  for (const log of logs || []) {
    const sh = (log as any).products?.shorthand || log.product_id;
    if (!agg[sh]) agg[sh] = { qty: 0, shorthand: sh };
    agg[sh].qty++;
  }

  return {
    sessionId: session.id,
    items: Object.values(agg),
    total: Number(session.total_amount),
    wn: session.wardrobe_number || undefined,
  };
}

type PayPhase = 'choose' | 'nfc-scan' | 'input-coat' | 'coat-not-found' | 'input-bag' | 'bag-not-found' | 'show-order' | 'confirm-payment';

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
  const cancelRef = useRef<(() => void) | null>(null);
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const { data: productsData } = useProducts();

  const [nfcOrderData, setNfcOrderData] = useState<NfcOrderData | null>(null);
  const [phase, setPhase] = useState<PayPhase>('choose');
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [foundSessionId, setFoundSessionId] = useState<string | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'pin' | 'cash' | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const resetToChoose = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
    setNfcOrderData(null);
    setPhase('choose');
    setCoatNumber('');
    setBagNumber('');
    setFoundSessionId(null);
  }, []);

  // NFC scan flow
  const startNfcScan = useCallback(async () => {
    setPhase('nfc-scan');
    setNfcOrderData(null);

    try {
      const { promise, cancel } = scanNfcTag(120000);
      cancelRef.current = cancel;
      const result = await promise;

      if (!mountedRef.current) return;

      const dbOrder = await fetchDbOrder(result.uid);

      if (dbOrder) {
        setNfcOrderData({ uid: result.uid, ...dbOrder, source: 'db' });
        setFoundSessionId(dbOrder.sessionId);

        // Sync NFC tag with DB data
        const dbSummary = dbOrder.items.map(i => `${i.qty}x${i.shorthand}`).join(',');
        const dbPayload = JSON.stringify({
          items: dbSummary,
          total: dbOrder.total,
          ...(dbOrder.wn ? { wn: dbOrder.wn } : {}),
        });

        try {
          const nfcSummary = result.message ? (() => { try { return JSON.parse(result.message!); } catch { return null; } })() : null;
          const nfcNeedsUpdate = !nfcSummary ||
            nfcSummary.items !== dbSummary ||
            nfcSummary.total !== dbOrder.total ||
            (nfcSummary.wn || '') !== (dbOrder.wn || '');

          if (nfcNeedsUpdate) {
            const { promise: wp, cancel: wc } = writeNfcTag(dbPayload, 10000);
            cancelRef.current = wc;
            await wp;
          }
        } catch { /* write failed, DB is truth */ }

        setPhase('show-order');
      } else if (result.message) {
        try {
          const json = JSON.parse(result.message);
          if (json.items && typeof json.items === 'string') {
            const parsedItems = json.items.split(',').map((entry: string) => {
              const match = entry.match(/^(\d+)x(.+)$/);
              return match ? { qty: parseInt(match[1]), shorthand: match[2] } : { qty: 1, shorthand: entry };
            });
            setNfcOrderData({ uid: result.uid, items: parsedItems, total: json.total ?? 0, wn: json.wn, source: 'nfc' });
            setPhase('show-order');
          } else {
            setPhase('choose');
          }
        } catch {
          setPhase('choose');
        }
      } else {
        setPhase('choose');
      }
    } catch {
      if (mountedRef.current) setPhase('choose');
    }
  }, []);

  const handleCancelNfc = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
    resetToChoose();
  }, [resetToChoose]);

  // Number pad handler
  const handleNumKey = (key: string) => {
    if (phase === 'input-coat') {
      if (key === 'DEL') setCoatNumber('');
      else if (coatNumber.length < 3) setCoatNumber(coatNumber + key);
    } else if (phase === 'input-bag') {
      if (key === 'DEL') setBagNumber('');
      else if (bagNumber.length < 3) setBagNumber(bagNumber + key);
    }
  };

  // Auto-lookup coat number
  useEffect(() => {
    if (phase !== 'input-coat' || coatNumber.length < 3) return;
    const t = setTimeout(async () => {
      const result = await fetchDbOrderByWardrobe(`C${coatNumber}`);
      if (result) {
        setNfcOrderData({ uid: '', items: result.items, total: result.total, wn: result.wn, source: 'db' });
        setFoundSessionId(result.sessionId);
        setFeedback('success');
        setTimeout(() => { setFeedback(null); setPhase('show-order'); }, 1000);
      } else {
        setPhase('coat-not-found');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [coatNumber, phase]);

  // Auto-lookup bag number
  useEffect(() => {
    if (phase !== 'input-bag' || bagNumber.length < 3) return;
    const t = setTimeout(async () => {
      const result = await fetchDbOrderByWardrobe(`B${bagNumber}`);
      if (result) {
        setNfcOrderData({ uid: '', items: result.items, total: result.total, wn: result.wn, source: 'db' });
        setFoundSessionId(result.sessionId);
        setFeedback('success');
        setTimeout(() => { setFeedback(null); setPhase('show-order'); }, 1000);
      } else {
        setFeedback('error');
        setTimeout(() => { setFeedback(null); setPhase('bag-not-found'); }, 1500);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [bagNumber, phase]);

  // Step 1: choose PIN or Cash → go to confirmation screen
  const processPaymentForSession = useCallback((method: 'pin' | 'cash') => {
    setPendingPaymentMethod(method);
    setPhase('confirm-payment');
  }, []);

  // Step 2a: "BETAALD" — erase everything
  const confirmPaid = useCallback(async () => {
    if (!nfcOrderData || !foundSessionId) return;
    try {
      // Delete drink_logs for this session
      await supabase.from('drink_logs').delete().eq('session_id', foundSessionId);

      // Archive the session, reset total
      await updateSession.mutateAsync({
        id: foundSessionId,
        actual_paid_amount: nfcOrderData.total,
        status: 'paid',
      });

      // Try to erase NFC tag
      if (nfcOrderData.uid) {
        try {
          const { promise, cancel } = eraseNfcTag(10000);
          cancelRef.current = cancel;
          await promise;
        } catch { /* NFC erase failed, DB is done */ }
      }

      // Also call batch-erase edge function to clean up by wardrobe number
      if (nfcOrderData.wn) {
        try {
          await supabase.functions.invoke('batch-erase', {
            body: { wardrobe_number: nfcOrderData.wn, nfc_uid: nfcOrderData.uid || undefined },
          });
        } catch { /* edge function failed, main cleanup done */ }
      }

      // Play notification sound
      try { new Audio('/notification.mp3').play(); } catch {}

      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        resetToChoose();
        if (pendingPaymentMethod === 'pin') onPin();
        else onCash();
      }, 2000);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [nfcOrderData, foundSessionId, updateSession, pendingPaymentMethod, onPin, onCash, resetToChoose]);

  // Step 2b: "NIET BETAALD" — keep everything, go back
  const confirmNotPaid = useCallback(() => {
    resetToChoose();
  }, [resetToChoose]);

  // Process payment with items from bar
  const processPaymentWithItems = useCallback(async (method: 'pin' | 'cash') => {
    if (!hasItems) return;

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

  // Render order display (shared between NFC and number lookup)
  const renderOrderView = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="bg-card border rounded-lg p-5 text-left max-w-sm w-full" style={{ borderColor: '#00cc1340' }}>
        {nfcOrderData?.uid && (
          <p className="text-xs font-mono mb-3 break-all" style={{ color: '#00cc13' }}>UID: {nfcOrderData.uid}</p>
        )}
        {nfcOrderData?.source === 'db' && (
          <p className="text-xs text-muted-foreground mb-2">📊 Data uit database</p>
        )}
        <div className="space-y-2">
          {nfcOrderData?.items.map((item, i) => {
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
          <span className="font-extrabold text-xl" style={{ color: '#00cc13' }}>€{Number(nfcOrderData?.total ?? 0).toFixed(2)}</span>
        </div>
        {nfcOrderData?.wn && (
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
      <div className="flex flex-col items-center gap-3 mt-4" style={{ width: '80%' }}>
        <button
          onClick={() => processPaymentForSession('pin')}
          className="w-full py-3 font-extrabold uppercase text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380' }}
        >
          <CreditCard className="w-4 h-4" /> PIN
        </button>
        <button
          onClick={() => processPaymentForSession('cash')}
          className="w-full py-3 font-extrabold uppercase text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380' }}
        >
          <Banknote className="w-4 h-4" /> CONTANT
        </button>
        <button
          onClick={resetToChoose}
          className="w-full py-2 font-extrabold uppercase text-sm"
          style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );

  // Render number pad
  const renderNumPad = (value: string, label: string) => (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2" style={{ color: '#00cc13' }}>{label}</h2>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full" style={{ maxWidth: '280px' }}>
          <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(16px, 3vh, 32px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330' }}>
            {value || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-0">
          {NUM_KEYS.map((key, i) => (
            <button key={i} onClick={() => key && handleNumKey(key)} disabled={!key} className="py-3 text-2xl font-extrabold uppercase disabled:invisible" style={{ backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a', color: key === 'DEL' ? '#fff' : '#e5e5e5', border: '1px solid #333' }}>{key}</button>
          ))}
        </div>
      </div>
      <button
        onClick={resetToChoose}
        className="mx-4 mb-4 py-3 font-extrabold uppercase text-sm"
        style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
      >
        CANCEL
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NfcOverlay status={nfcStatus} onCancel={handleCancelNfc} />

      {/* If there are bar items, show original payment flow */}
      {hasItems ? (
        <>
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Bestelling ({items.length} items)
            </h2>
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
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <span className="font-bold uppercase tracking-widest" style={{ fontSize: '1rem' }}>Totaal</span>
              <span className="text-2xl font-extrabold" style={{ color: '#00cc13' }}>€{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0">
            <div className="flex">
              <button
                onClick={() => processPaymentWithItems('pin')}
                disabled={!hasItems}
                className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 border-r border-border"
              >
                <CreditCard className="w-4 h-4" /> PIN
              </button>
              <button
                onClick={() => processPaymentWithItems('cash')}
                disabled={!hasItems}
                className="pos-btn flex-1 bg-secondary text-secondary-foreground py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
              >
                <Banknote className="w-4 h-4" /> CONTANT
              </button>
            </div>
            <button
              onClick={() => processPaymentWithItems('pin')}
              disabled={!hasItems}
              className="pos-btn py-5 text-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold uppercase"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}
            >
              <Send className="w-6 h-6" /> SEND
            </button>
          </div>
        </>
      ) : (
        /* No bar items — lookup mode */
        <div className="flex-1 flex flex-col">
          {phase === 'choose' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
              <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>BETALING</h2>
              <button
                onClick={startNfcScan}
                className="w-64 py-5 text-xl font-extrabold uppercase flex items-center justify-center gap-3"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}
              >
                <Nfc className="w-7 h-7" /> SCAN NFC
              </button>
              <button
                onClick={() => setPhase('input-coat')}
                className="w-64 py-5 text-xl font-extrabold uppercase flex items-center justify-center gap-3"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}
              >
                <Hash className="w-7 h-7" /> NUMMER ZOEKEN
              </button>
            </div>
          )}

          {phase === 'nfc-scan' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[nfcPulse_3s_ease-in-out_infinite]">
              <span className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
                Scan NFC
              </span>
              <Nfc className="w-32 h-32" style={{ color: '#00cc13', filter: 'drop-shadow(0 0 20px #00cc1360)' }} />
              <button
                onClick={resetToChoose}
                className="mt-4 px-8 py-3 font-extrabold uppercase"
                style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
              >
                CANCEL
              </button>
            </div>
          )}

          {phase === 'input-coat' && renderNumPad(coatNumber, 'JASNUMMER')}

          {phase === 'coat-not-found' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
              <FeedbackOverlay type={feedback} />
              <div className="text-center font-extrabold uppercase tracking-[0.1em]" style={{ color: '#ef4444', fontSize: 'clamp(24px, 5vw, 40px)' }}>NIET GEVONDEN</div>
              <div className="text-center text-muted-foreground text-lg font-bold">Jasnummer #{coatNumber} niet gevonden.<br />Misschien een tasnummer?</div>
              <button
                onClick={() => { setBagNumber(''); setPhase('input-bag'); }}
                className="px-8 py-4 text-xl font-extrabold uppercase"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}
              >
                TASNUMMER INVOEREN
              </button>
              <button
                onClick={resetToChoose}
                className="px-8 py-3 font-extrabold uppercase"
                style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
              >
                CANCEL
              </button>
            </div>
          )}

          {phase === 'input-bag' && renderNumPad(bagNumber, 'TASNUMMER')}

          {phase === 'bag-not-found' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
              <FeedbackOverlay type={feedback} />
              <div className="text-center font-extrabold uppercase tracking-[0.1em]" style={{ color: '#ef4444', fontSize: 'clamp(24px, 5vw, 40px)' }}>NIET GEVONDEN</div>
              <div className="text-center text-muted-foreground text-lg font-bold">Tasnummer #{bagNumber} niet gevonden.</div>
              <button
                onClick={() => { setBagNumber(''); setPhase('input-bag'); }}
                className="px-8 py-4 text-xl font-extrabold uppercase mb-3"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}
              >
                OPNIEUW PROBEREN
              </button>
              <button
                onClick={resetToChoose}
                className="px-8 py-3 font-extrabold uppercase"
                style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
              >
                CANCEL
              </button>
            </div>
          )}

          {phase === 'show-order' && renderOrderView()}

          {phase === 'confirm-payment' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
              <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
                {pendingPaymentMethod === 'pin' ? 'PIN' : 'CONTANT'}
              </h2>
              <div className="text-center text-lg font-bold text-muted-foreground">
                Totaal: <span style={{ color: '#00cc13' }}>€{Number(nfcOrderData?.total ?? 0).toFixed(2)}</span>
              </div>
              <button
                onClick={confirmPaid}
                className="py-5 text-xl font-extrabold uppercase flex items-center justify-center gap-3"
                style={{ width: '80%', maxWidth: '80vw', backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340' }}
              >
                ✓ BETAALD
              </button>
              <button
                onClick={confirmNotPaid}
                className="py-5 text-xl font-extrabold uppercase flex items-center justify-center gap-3"
                style={{ width: '80%', maxWidth: '80vw', backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 16px #ef444480' }}
              >
                ✗ NIET BETAALD
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
