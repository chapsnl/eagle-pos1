import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { DbProduct } from '@/hooks/useProducts';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { NumPad } from '@/components/pos/NumPad';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';
import { useCreateSession, useAddDrinkLogs, useUpdateSession } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';
import { useQueryClient } from '@tanstack/react-query';
import { enqueue, resolveSessionId, isOnline } from '@/lib/offlineQueue';
import { formatWardrobeNumber } from '@/lib/utils';

interface DirectOrderItem {
  product: DbProduct;
  quantity: number;
}


export const DirectPage = () => {
  const [items, setItems] = useState<DirectOrderItem[]>([]);
  const [showNumberPopup, setShowNumberPopup] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [payMode, setPayMode] = useState(false);
  const [retourMode, setRetourMode] = useState(false);
  const [retourFlash, setRetourFlash] = useState<string | null>(null);
  const [quickNumber, setQuickNumber] = useState('');
  const [showQuickNumpad, setShowQuickNumpad] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEntreeWarning, setShowEntreeWarning] = useState(false);
  const [payWardrobe, setPayWardrobe] = useState('');
  const [showTransferNumpad, setShowTransferNumpad] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [transferWarning, setTransferWarning] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSourceNumber, setTransferSourceNumber] = useState('');
  const submitLockRef = useRef(false);

  const qc = useQueryClient();
  const createSession = useCreateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const updateSession = useUpdateSession();
  const deviceId = useRef(getDeviceId()).current;

  

  // Existing logs for the currently entered quickNumber (so we can show what's already booked)
  const [existingLogs, setExistingLogs] = useState<{ product_id: string; product_name: string; quantity: number }[]>([]);

  useEffect(() => {
    if (quickNumber.length < 3) { setExistingLogs([]); return; }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadFor = async (wardrobeNum: string) => {
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('wardrobe_number', wardrobeNum)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!session) { setExistingLogs([]); return; }

      const fetchLogs = async () => {
        const { data } = await supabase
          .from('drink_logs')
          .select('product_id, products(full_name)')
          .eq('session_id', session.id);
        if (cancelled || !data) return;
        const map = new Map<string, { product_id: string; product_name: string; quantity: number }>();
        for (const log of data) {
          const name = (log.products as any)?.full_name ?? 'Unknown';
          const pid = log.product_id;
          const existing = map.get(pid);
          if (existing) existing.quantity++;
          else map.set(pid, { product_id: pid, product_name: name, quantity: 1 });
        }
        setExistingLogs(Array.from(map.values()));
      };

      await fetchLogs();
      channel = supabase
        .channel(`direct_drink_logs_${session.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drink_logs', filter: `session_id=eq.${session.id}` }, fetchLogs)
        .subscribe();
    };

    loadFor(quickNumber);
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [quickNumber]);

  // Extracted submit logic for reuse
  const submitOrder = useCallback(async (wardrobeNum: string, orderItems: DirectOrderItem[], shouldPay = false) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    const total = orderItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

    // Optimistic reset
    setItems([]);
    setQuickNumber('');
    setShowQuickNumpad(false);
    setShowNumberPopup(false);
    setNumberInput('');

    try {
      const logsData = orderItems.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );

      if (!isOnline()) {
        const tempId = crypto.randomUUID();
        await enqueue({ type: 'create_session', payload: { tempId, wardrobe_number: wardrobeNum, is_event_numbered: true } });
        await enqueue({ type: 'lock_session', payload: { id: tempId, locked_by: deviceId } });
        await enqueue({ type: 'insert_drink_logs', payload: { session_id: tempId, logs: logsData } });
        await enqueue({ type: 'update_session', payload: { id: tempId, total_amount: total } });
        await enqueue({ type: 'unlock_session', payload: { id: tempId } });
      } else {
        const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
        let session = cachedSessions?.find(s => s.wardrobe_number === wardrobeNum) ?? null;

        if (session) {
          const { data: fresh } = await supabase
            .from('sessions')
            .select('locked_by, locked_at')
            .eq('id', session.id)
            .single();
          const lockedBy = fresh?.locked_by;
          const lockedAt = fresh?.locked_at;
          if (lockedBy && lockedBy !== deviceId) {
            const lockAge = lockedAt ? Date.now() - new Date(lockedAt).getTime() : Infinity;
            if (lockAge < 60000) {
              toast.error('Dit nummer is in gebruik door een andere medewerker.');
              setItems(orderItems);
              return;
            }
          }
        } else {
          const { data: closedSession } = await supabase
            .from('sessions')
            .select('id')
            .eq('wardrobe_number', wardrobeNum)
            .in('status', ['paid', 'archived'])
            .limit(1)
            .maybeSingle();
          if (closedSession) {
            toast.error(`Nummer ${wardrobeNum} is al afgerekend en gesloten.`);
            setItems(orderItems);
            return;
          }
        }

        if (!session) {
          session = await createSession.mutateAsync({
            wardrobe_number: wardrobeNum,
            is_event_numbered: true,
          });
        }

        const logs = logsData.map(l => ({ ...l, session_id: session.id }));
        await Promise.all([
          supabase.from('sessions').update({ locked_by: deviceId, locked_at: new Date().toISOString() } as any).eq('id', session.id),
          addDrinkLogs.mutateAsync(logs),
        ]);

        const newTotal = Number(session.total_amount ?? 0) + total;
        const updateData: any = { id: session.id, total_amount: newTotal };
        if (shouldPay) {
          updateData.status = 'paid';
          updateData.actual_paid_amount = newTotal;
        }
        await Promise.all([
          updateSession.mutateAsync(updateData),
          supabase.from('sessions').update({ locked_by: null, locked_at: null } as any).eq('id', session.id),
        ]);
      }
    } catch {
      toast.error('Opslaan mislukt — probeer opnieuw');
      setItems(orderItems);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }, [qc, createSession, addDrinkLogs, updateSession, deviceId]);

  const addProduct = useCallback((product: DbProduct) => {
    if (retourMode) {
      const inItems = items.find((i) => i.product.id === product.id);
      if (!inItems || inItems.quantity <= 0) return;
      setRetourFlash(product.id);
      setTimeout(() => setRetourFlash(null), 600);
      setItems((prev) => prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity !== 0));
      setRetourMode(false);
      return;
    }

    // Build new items list
    let newItems: DirectOrderItem[];
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      newItems = items.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newItems = [{ product, quantity: 1 }, ...items];
    }

    // No auto-submit: wait for NEXT button

    setItems(newItems);
  }, [retourMode, items, quickNumber, submitOrder]);

  const [quickWarning, setQuickWarning] = useState(false);

  const handleQuickNumberKey = useCallback((key: string) => {
    if (key === 'DEL') { setQuickNumber(''); setQuickWarning(false); return; }
    if (key === 'BACK') { setQuickNumber(prev => prev.slice(0, -1)); setQuickWarning(false); return; }
    if (quickNumber.length < 3) {
      setQuickNumber(prev => prev + key);
      setQuickWarning(false);
    }
  }, [quickNumber]);

  const handleQuickConfirm = useCallback(async () => {
    if (quickNumber.length === 0) { setQuickWarning(true); return; }
    const num = quickNumber;
    // Check cache first
    const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
    const exists = cachedSessions?.some(s => s.wardrobe_number === num);
    if (!exists) {
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('wardrobe_number', num)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (!data) {
        setQuickWarning(true);
        return;
      }
    }
    setQuickWarning(false);
    if (items.length > 0) {
      submitOrder(num, items);
    } else {
      setShowQuickNumpad(false);
    }
  }, [quickNumber, items, submitOrder, qc]);

  // Auto-confirm when 3 digits entered in quick popup
  useEffect(() => {
    if (!showQuickNumpad) return;
    if (quickNumber.length !== 3) return;
    const t = window.setTimeout(() => { handleQuickConfirm(); }, 150);
    return () => window.clearTimeout(t);
  }, [quickNumber, showQuickNumpad, handleQuickConfirm]);

  const handleNumberKey = useCallback((key: string) => {
    if (key === 'DEL') { setNumberInput(''); return; }
    if (key === 'BACK') { setNumberInput(prev => prev.slice(0, -1)); return; }
    if (numberInput.length < 3) setNumberInput(prev => prev + key);
  }, [numberInput]);

  const handleNumberButton = useCallback(() => {
    if (items.length === 0) return;
    setNumberInput('');
    setShowWarning(false);
    setShowNumberPopup(true);
  }, [items]);

  const handleConfirmNumber = useCallback(async () => {
    if (numberInput.length === 0) {
      setShowWarning(true);
      return;
    }
    await submitOrder(numberInput, items, payMode);
    setPayMode(false);
  }, [numberInput, items, submitOrder, payMode]);

  const handleNext = useCallback(() => {
    if (items.length > 0 && quickNumber.length > 0) {
      // Number already set via quick entry → submit directly
      submitOrder(quickNumber, items);
      return;
    }
    if (items.length > 0) {
      setNumberInput('');
      setShowWarning(false);
      setShowNumberPopup(true);
      return;
    }
    setItems([]);
    setQuickNumber('');
    setRetourMode(false);
  }, [items, quickNumber, submitOrder]);

  const handlePayButton = useCallback(() => {
    if (items.length === 0 && existingLogs.length === 0) return;
    // If a guest number is already entered via quick entry, show confirm popup like NR/OPEN
    if (quickNumber.length > 0) {
      setPayWardrobe(quickNumber);
      setShowPayDialog(true);
      return;
    }
    setPayMode(true);
    setNumberInput('');
    setShowWarning(false);
    setShowNumberPopup(true);
  }, [items, existingLogs, quickNumber]);

  const handlePayVerwerk = useCallback(() => {
    setShowPayDialog(false);
    setShowEntreeWarning(true);
  }, []);

  const executePayVerwerk = useCallback(() => {
    setShowEntreeWarning(false);
    submitOrder(payWardrobe, items, true);
    setPayWardrobe('');
  }, [payWardrobe, items, submitOrder]);

  const handleTransferKey = useCallback((key: string) => {
    setTransferWarning(null);
    if (key === 'DEL') { setTransferNumber(''); return; }
    if (key === 'BACK') { setTransferNumber(prev => prev.slice(0, -1)); return; }
    if (transferNumber.length < 3) setTransferNumber(prev => prev + key);
  }, [transferNumber]);

  const handleOpenTransfer = useCallback(async () => {
    if (quickNumber.length === 0) return;
    const currentNum = quickNumber;
    setTransferSourceNumber(currentNum);
    if (items.length > 0) {
      await submitOrder(currentNum, items, false);
    }
    setTransferNumber('');
    setTransferWarning(null);
    setShowTransferNumpad(true);
  }, [quickNumber, items, submitOrder]);

  const handleTransferConfirmOpen = useCallback(async () => {
    const newNum = transferNumber.trim();
    if (newNum.length === 0) { setTransferWarning('Voer een nieuw nummer in!'); return; }
    if (newNum === transferSourceNumber) { setTransferWarning('Dit is al het huidige nummer!'); return; }
    const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
    const existsInActive = cachedSessions?.some(s => s.wardrobe_number === newNum);
    if (existsInActive) { setTransferWarning(`Nummer ${formatWardrobeNumber(newNum)} is al in gebruik!`); return; }
    const { data: closedSession } = await supabase
      .from('sessions').select('id')
      .eq('wardrobe_number', newNum)
      .in('status', ['paid', 'archived'])
      .limit(1).maybeSingle();
    if (closedSession) { setTransferWarning(`Nummer ${formatWardrobeNumber(newNum)} is al afgesloten in deze shift!`); return; }
    setShowTransferNumpad(false);
    setShowTransferConfirm(true);
  }, [transferNumber, transferSourceNumber, qc]);

  const executeTransfer = useCallback(async () => {
    const oldNum = transferSourceNumber;
    const newNum = transferNumber.trim();
    setTransferLoading(true);
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('wardrobe_number', oldNum)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (!session) {
        toast.error('Sessie niet gevonden — probeer opnieuw');
        setTransferLoading(false);
        return;
      }
      await supabase.from('sessions').update({ wardrobe_number: newNum } as any).eq('id', session.id);
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
      setShowTransferConfirm(false);
      setTransferNumber('');
      setTransferSourceNumber('');
      setQuickNumber(newNum);
      setExistingLogs([]);
    } catch (err: any) {
      toast.error(`Transfer mislukt: ${err.message}`);
    } finally {
      setTransferLoading(false);
    }
  }, [transferSourceNumber, transferNumber, qc]);

  const handleTransferCancel = useCallback(() => {
    setShowTransferNumpad(false);
    setShowTransferConfirm(false);
    setTransferNumber('');
    setTransferWarning(null);
    setTransferLoading(false);
    setTransferSourceNumber('');
  }, []);

  const popupOrderLines: OrderLine[] = (() => {
    const merged = new Map<string, { name: string; qty: number }>();
    for (const l of existingLogs) merged.set(l.product_id, { name: l.product_name, qty: l.quantity });
    for (const i of items) {
      const ex = merged.get(i.product.id);
      if (ex) ex.qty += i.quantity;
      else merged.set(i.product.id, { name: i.product.full_name, qty: i.quantity });
    }
    return Array.from(merged.values()).filter(l => l.qty !== 0).map(l => ({ name: l.name, qty: l.qty, price: 0 }));
  })();

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);


  return (
    <div className="flex-1 flex overflow-hidden h-full relative" style={{ ...(retourMode ? { border: '4px solid #ef4444', boxShadow: 'inset 0 0 30px rgba(239,68,68,0.15)' } : {}) }}>
      {/* Retour mode banner */}
      {retourMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: '#ef4444', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>
          ⚠ RETOUR MODUS ACTIEF ⚠
        </div>
      )}

      {/* Left column - Order summary */}
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden" style={{ width: '20%', backgroundColor: retourMode ? '#1a0a0a' : '#121212', borderRight: `1px solid ${retourMode ? '#ef4444' : '#333'}`, transition: 'background-color 0.3s ease' }}>
        <div className="text-center py-3 border-b" style={{ borderColor: '#333' }}>
          <span className="font-extrabold uppercase" style={{ color: '#00cc13', fontSize: 'clamp(14px, 2vw, 22px)', letterSpacing: '0.1em' }}>DIRECT</span>
        </div>

        {/* Quick Number Entry Button */}
        <div className="flex items-center justify-center" style={{ padding: 'clamp(6px, 1vh, 14px) clamp(4px, 0.5vw, 10px)' }}>
          <button
            onClick={() => { setQuickNumber(''); setShowQuickNumpad(true); }}
            className="w-full font-extrabold uppercase flex flex-col items-center justify-center transition-all duration-150 active:brightness-75"
            style={{
              backgroundColor: quickNumber.length > 0 ? '#00cc13' : 'transparent',
              color: quickNumber.length > 0 ? '#fff' : '#00cc13',
              border: '2px dashed #00cc1360',
              borderRadius: 12,
              padding: 'clamp(8px, 1.2vh, 18px) 4px',
            }}
          >
            <span style={{ fontSize: 'clamp(20px, 3.5vw, 38px)' }}>?</span>
            <span style={{ fontSize: 'clamp(10px, 1.5vw, 16px)', letterSpacing: '0.1em' }}>
              {quickNumber.length > 0 ? formatWardrobeNumber(quickNumber) : 'NR'}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
          {items.length > 0 && (
            <>
              <div className="text-center py-1" style={{ borderBottom: '1px solid #333' }}>
                <span className="font-extrabold uppercase" style={{ color: '#00cc13', fontSize: 'clamp(9px, 1.4vw, 14px)', letterSpacing: '0.1em' }}>Nieuwe Bestelling</span>
              </div>
              {items.map((item) => (
                <div key={`new-${item.product.id}`} style={{ color: '#00cc13', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', fontWeight: 800 }}>
                  {item.quantity} x {item.product.full_name}
                </div>
              ))}
            </>
          )}
          {existingLogs.length > 0 && (
            <>
              <div className="text-center py-1" style={{ borderBottom: '1px solid #333', marginTop: items.length > 0 ? '8px' : '0' }}>
                <span className="font-extrabold uppercase" style={{ color: '#888', fontSize: 'clamp(9px, 1.4vw, 14px)', letterSpacing: '0.1em' }}>Reeds Besteld</span>
              </div>
              {existingLogs.map((log) => (
                <div key={`existing-${log.product_id}`} style={{ color: '#e5e5e5', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', fontWeight: 400 }}>
                  {log.quantity} x {log.product_name}
                </div>
              ))}
            </>
          )}
          {items.length === 0 && existingLogs.length === 0 && (
            <div className="text-center py-4" style={{ color: '#555', fontSize: 'clamp(10px, 1.2vw, 14px)' }}>Geen producten</div>
          )}
        </div>

        {/* Transfer NR button */}
        {quickNumber.length > 0 && (
          <div className="px-2 py-2" style={{ borderTop: '1px solid #333' }}>
            <button
              onClick={handleOpenTransfer}
              className="w-full font-extrabold uppercase transition-all active:scale-[0.97]"
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: 8,
                padding: 'clamp(8px, 1.2vh, 14px) 4px',
                fontSize: 'clamp(10px, 1.4vw, 14px)',
                letterSpacing: '0.08em',
                boxShadow: '0 0 10px #ef444460',
              }}
            >
              TRANSFER NR
            </button>
          </div>
        )}
      </div>

      {/* Right column - Product grid */}
      <div className="flex flex-col overflow-hidden" style={{ width: '80%' }}>
        <ProductGrid
          onAddProduct={addProduct}
          onPay={handlePayButton}
          onToggleRetour={() => setRetourMode((m) => !m)}
          onNext={handleNext}
          retourMode={retourMode}
        />
      </div>

      {/* Quick NR popup with dimmed background */}
      {showQuickNumpad && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
            <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
            <div className="flex items-center justify-center w-full">
              <div className="w-full" style={{ maxWidth: '280px' }}>
                <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: `3px solid ${quickWarning ? '#ef4444' : '#00cc13'}`, boxShadow: quickWarning ? '0 0 12px #ef444480, 0 0 24px #ef444430' : '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                  {quickNumber.length > 0 ? formatWardrobeNumber(quickNumber) : <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
                {quickWarning && (
                  <p className="text-center font-bold mt-2" style={{ color: '#ef4444', fontSize: 'clamp(12px, 2vw, 16px)' }}>{quickNumber.length === 0 ? 'Voer een nummer in!' : 'Nummer bestaat niet!'}</p>
                )}
              </div>
            </div>
            <NumPad onKey={handleQuickNumberKey} />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setShowQuickNumpad(false); setQuickNumber(''); setQuickWarning(false); }}
                className="flex-1 py-4 font-extrabold uppercase text-lg"
                style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: 6 }}
              >
                CANCEL
              </button>
              <button
                onClick={handleQuickConfirm}
                className="flex-1 py-4 font-extrabold uppercase text-lg"
                style={{ backgroundColor: '#00cc13', color: '#fff', borderRadius: 6 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Number entry popup overlay (from NUMBER grid button) */}
      {showNumberPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
            <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
            <div className="flex items-center justify-center w-full">
              <div className="w-full" style={{ maxWidth: '280px' }}>
                 <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: `3px solid ${showWarning ? '#ef4444' : '#00cc13'}`, boxShadow: showWarning ? '0 0 12px #ef444480, 0 0 24px #ef444430' : '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                  {formatWardrobeNumber(numberInput) || <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
                {showWarning && (
                  <p className="text-center font-bold mt-2" style={{ color: '#ef4444', fontSize: 'clamp(12px, 2vw, 16px)' }}>Voer een gastnummer in!</p>
                )}
              </div>
            </div>
            <NumPad onKey={handleNumberKey} disabled={isSubmitting} />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setShowNumberPopup(false); setShowWarning(false); setPayMode(false); }}
                className="flex-1 py-4 font-extrabold uppercase text-lg"
                style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: 6 }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmNumber}
                disabled={isSubmitting}
                className="flex-1 py-4 font-extrabold uppercase text-lg disabled:opacity-50"
                style={{ backgroundColor: '#00cc13', color: '#fff', borderRadius: 6 }}
              >
                {isSubmitting ? 'LADEN...' : 'BOEK'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SessionPopup
        open={showPayDialog}
        onClose={() => setShowPayDialog(false)}
        title="Bestelling"
        subtitle={formatWardrobeNumber(payWardrobe)}
        orderLines={popupOrderLines}
        showTotal={false}
        showItemCount
        actions={[
          { label: 'CANCEL', onClick: () => setShowPayDialog(false), variant: 'cancel' as const },
          { label: 'VERWERK', onClick: handlePayVerwerk, variant: 'confirm' as const },
        ]}
      />

      <SessionPopup
        open={showEntreeWarning}
        onClose={() => setShowEntreeWarning(false)}
        title="Let op"
        subtitle="Weet je zeker dat je niets bent vergeten?"
        orderLines={[]}
        showTotal={false}
        actions={[
          { label: 'TERUG', onClick: () => setShowEntreeWarning(false), variant: 'cancel' as const },
          { label: 'VERDER', onClick: executePayVerwerk, variant: 'confirm' as const },
        ]}
      />

      {/* Transfer numpad overlay */}
      {showTransferNumpad && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
            <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#ef4444' }}>TRANSFER NR</h2>
            <p className="text-sm font-bold uppercase text-center" style={{ color: '#888' }}>
              Huidig: <span style={{ color: '#fff' }}>{formatWardrobeNumber(transferSourceNumber)}</span>{' → '}Nieuw nummer:
            </p>
            <div className="flex items-center justify-center w-full">
              <div className="w-full" style={{ maxWidth: '280px' }}>
                <div
                  className="w-full font-extrabold text-center flex items-center justify-center"
                  style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: '3px solid #ef4444', boxShadow: '0 0 12px #ef444480, 0 0 24px #ef444430', borderRadius: '12px' }}
                >
                  {transferNumber.length > 0 ? formatWardrobeNumber(transferNumber) : <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
                {transferWarning && (
                  <p className="text-center font-bold mt-2" style={{ color: '#ef4444', fontSize: 'clamp(12px, 2vw, 16px)' }}>{transferWarning}</p>
                )}
              </div>
            </div>
            <NumPad onKey={handleTransferKey} />
            <div className="flex gap-3 w-full">
              <button onClick={handleTransferCancel} className="flex-1 py-4 font-extrabold uppercase text-lg" style={{ backgroundColor: '#333', color: '#fff', borderRadius: 6 }}>CANCEL</button>
              <button onClick={handleTransferConfirmOpen} className="flex-1 py-4 font-extrabold uppercase text-lg" style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: 6, boxShadow: '0 0 12px #ef444480' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <SessionPopup
        open={showTransferConfirm}
        onClose={handleTransferCancel}
        title="TRANSFER NR"
        subtitle={`Nummer ${formatWardrobeNumber(transferSourceNumber)} overdragen naar ${formatWardrobeNumber(transferNumber)}. Weet je het zeker?`}
        orderLines={[]}
        showTotal={false}
        actions={[
          { label: 'NEE', onClick: handleTransferCancel, variant: 'cancel' as const },
          { label: transferLoading ? 'BEZIG...' : 'JA', onClick: executeTransfer, variant: 'confirm' as const },
        ]}
      />
    </div>
  );
};
