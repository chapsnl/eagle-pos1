import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { toast } from 'sonner';
import { DbProduct } from '@/hooks/useProducts';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { FeedbackType } from '@/types/pos';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { Send, AlertCircle } from 'lucide-react';
import { NumPad } from '@/components/pos/NumPad';
import { useUpdateSession, useAddDrinkLogs, useCreateSession } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';
import { broadcastOrder, clearOrder } from '@/lib/orderSync';
import { formatWardrobeNumber } from '@/lib/utils';
import { getDeviceId } from '@/hooks/useDeviceId';

interface TestOrderItem {
  product: DbProduct;
  quantity: number;
}




type Phase = 'input' | 'products';

interface TestPageProps {
  initialGuestNumber?: string | null;
  initialSessionData?: { sessionId: string; wardrobeNumber: string; totalAmount: number } | null;
  onGuestNumberConsumed?: () => void;
  onNavigateToOpen?: () => void;
}

export interface TestPageHandle {
  saveAndCleanup: () => void;
}

export const TestPage = forwardRef<TestPageHandle, TestPageProps>(({ initialGuestNumber, initialSessionData, onGuestNumberConsumed, onNavigateToOpen }, ref) => {

  // Lock to landscape on this page
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const so = screen.orientation as any;
        if (so?.lock) await so.lock('landscape');
      } catch {}
    };
    lockOrientation();
    return () => {
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, []);

  const [phase, setPhase] = useState<Phase>(initialSessionData ? 'products' : 'input');
  const [activeField, setActiveField] = useState<'coat' | null>('coat');
  const [coatNumber, setCoatNumber] = useState('');
  const [items, setItems] = useState<TestOrderItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [existingLogs, setExistingLogs] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number }[]>([]);
  const [showLockedWarning, setShowLockedWarning] = useState(false);
  const [pendingWardrobe, setPendingWardrobe] = useState<string | null>(null);
  const [showClosedBlockDialog, setShowClosedBlockDialog] = useState(false);
  const [showTransferNumpad, setShowTransferNumpad] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [transferWarning, setTransferWarning] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const lastCoatLookupRef = useRef<string | null>(null);
  const qc = useQueryClient();
  const updateSession = useUpdateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const createSession = useCreateSession();

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const existingTotal = existingLogs.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const deviceId = useRef(getDeviceId()).current;

  // Lock a session for this device
  const lockSession = useCallback(async (sid: string) => {
    await supabase.from('sessions').update({ locked_by: deviceId, locked_at: new Date().toISOString() } as any).eq('id', sid);
  }, [deviceId]);

  // Unlock a session
  const unlockSession = useCallback(async (sid: string) => {
    await supabase.from('sessions').update({ locked_by: null, locked_at: null } as any).eq('id', sid);
  }, []);

  // Live drink logs via Realtime subscription + initial fetch
  const [liveDbLogs, setLiveDbLogs] = useState<{ product_id: string; product_name: string; quantity: number }[]>([]);

  const fetchLogsFromDb = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('drink_logs')
      .select('price_at_time, product_id, timestamp, products(full_name)')
      .eq('session_id', sid);
    if (!data) return;
    const map = new Map<string, { product_id: string; product_name: string; quantity: number; unit_price: number }>();
    const dbMap = new Map<string, { product_id: string; product_name: string; quantity: number; last_touched_at: number }>();
    for (const log of data) {
      const name = (log.products as any)?.full_name ?? 'Unknown';
      const pid = log.product_id;
      const touchedAt = new Date(log.timestamp).getTime();
      const existing = map.get(pid);
      if (existing) existing.quantity++;
      else map.set(pid, { product_id: pid, product_name: name, quantity: 1, unit_price: log.price_at_time });
      const dbExisting = dbMap.get(pid);
      if (dbExisting) {
        dbExisting.quantity++;
        dbExisting.last_touched_at = Math.max(dbExisting.last_touched_at, touchedAt);
      } else {
        dbMap.set(pid, { product_id: pid, product_name: name, quantity: 1, last_touched_at: touchedAt });
      }
    }
    setExistingLogs(Array.from(map.values()));
    setLiveDbLogs(
      Array.from(dbMap.values())
        .sort((a, b) => b.last_touched_at - a.last_touched_at)
        .map(({ last_touched_at, ...item }) => item)
    );
  }, []);

  useEffect(() => {
    if (!sessionId) { setExistingLogs([]); setLiveDbLogs([]); return; }
    fetchLogsFromDb(sessionId);
    const channel = supabase
      .channel(`drink_logs_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drink_logs', filter: `session_id=eq.${sessionId}` },
        () => { fetchLogsFromDb(sessionId); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchLogsFromDb]);

  const autoCreateAndOpen = useCallback(async (wardrobeNum: string) => {
    try {
      // Check cache first instead of network
      const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
      if (cachedSessions?.some(s => s.wardrobe_number === wardrobeNum)) {
        toast.error(`Gast ${wardrobeNum} bestaat al als actieve klant!`);
        setCoatNumber('');
        lastCoatLookupRef.current = null;
        return;
      }
      const session = await createSession.mutateAsync({
        wardrobe_number: wardrobeNum,
        is_event_numbered: true,
      });
      await lockSession(session.id);
      setSessionId(session.id);
      setSessionTotal(Number(session.total_amount ?? 0));
      setPhase('products');
      setActiveField(null);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [createSession, lockSession, qc]);

  const resolveSessionByWardrobe = useCallback(async (wardrobeNum: string) => {
    try {
      // Look up from cached active sessions for fast ID resolution
      const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
      const cached = cachedSessions?.find(s => s.wardrobe_number === wardrobeNum) ?? null;

      if (!cached) {
        await autoCreateAndOpen(wardrobeNum);
        return;
      }

      // Fetch fresh lock state from DB — cache may be stale
      const { data: fresh } = await supabase
        .from('sessions')
        .select('locked_by, locked_at')
        .eq('id', cached.id)
        .single();

      const lockedBy = fresh?.locked_by;
      const lockedAt = fresh?.locked_at;
      if (lockedBy && lockedBy !== deviceId) {
        const lockAge = lockedAt ? Date.now() - new Date(lockedAt).getTime() : Infinity;
        if (lockAge < 60000) {
          setShowLockedWarning(true);
          return;
        }
      }
      await lockSession(cached.id);
      setSessionId(cached.id);
      setSessionTotal(Number(cached.total_amount ?? 0));
      setPhase('products');
      setActiveField(null);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [qc, deviceId, lockSession, autoCreateAndOpen]);

  // Auto-lookup coat number at 3 digits
  useEffect(() => {
    if (phase !== 'input') return;
    if (coatNumber.length < 3) { lastCoatLookupRef.current = null; return; }
    const wardrobe = coatNumber;
    if (lastCoatLookupRef.current === wardrobe) return;
    lastCoatLookupRef.current = wardrobe;
    const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
    const isActive = cachedSessions?.some(s => s.wardrobe_number === wardrobe);
    const t = window.setTimeout(async () => {
      if (!isActive) {
        // Only check closed sessions via network if not in active cache
        const { data: closedSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('wardrobe_number', wardrobe)
          .in('status', ['paid', 'archived'])
          .limit(1)
          .maybeSingle();
        if (closedSession) {
          setPendingWardrobe(wardrobe);
          setShowClosedBlockDialog(true);
          return;
        }
      }
      void resolveSessionByWardrobe(wardrobe);
    }, isActive ? 0 : 150);
    return () => window.clearTimeout(t);
  }, [coatNumber, phase, resolveSessionByWardrobe, qc]);

  // Handle direct navigation with full session data (e.g. from OPEN page BEWERK button)
  // Lock is already acquired by the caller — just set state
  useEffect(() => {
    if (!initialSessionData) return;
    const num = initialSessionData.wardrobeNumber.replace(/\D/g, '');
    const sid = initialSessionData.sessionId;
    setCoatNumber(num);
    setSessionId(sid);
    setSessionTotal(initialSessionData.totalAmount);
    setPhase('products');
    setActiveField(null);
    lastCoatLookupRef.current = num;
    onGuestNumberConsumed?.();
  }, [initialSessionData, onGuestNumberConsumed]);

  // Handle external navigation with a guest number (e.g. from OVERZICHT page)
  useEffect(() => {
    if (!initialGuestNumber || initialSessionData) return;
    const num = initialGuestNumber.replace(/\D/g, '');
    if (!num) return;
    setCoatNumber(num);
    lastCoatLookupRef.current = null;
    onGuestNumberConsumed?.();
  }, [initialGuestNumber, initialSessionData, onGuestNumberConsumed]);

  const handleNumKey = (key: string) => {
    if (key === 'DEL') {
      setCoatNumber('');
      setActiveField('coat');
      lastCoatLookupRef.current = null;
      return;
    }
    if (key === 'BACK') {
      if (activeField === 'coat') setCoatNumber(prev => prev.slice(0, -1));
      return;
    }
    if (activeField === 'coat') {
      if (coatNumber.length < 3) setCoatNumber(coatNumber + key);
    }
  };

  const addProduct = useCallback((product: DbProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const [showBonDialog, setShowBonDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEntreeWarning, setShowEntreeWarning] = useState(false);
  const [retourMode, setRetourMode] = useState(false);
  const [retourFlash, setRetourFlash] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (items.length === 0 || !sessionId) return;

    // Capture values before clearing state
    const sid = sessionId;
    const newTotal = Math.max(0, sessionTotal + total);
    const positiveItems = items.filter(i => i.quantity > 0);
    const negativeItems = items.filter(i => i.quantity < 0);
    const logs = positiveItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        session_id: sid,
        product_id: item.product.id,
        price_at_time: item.product.price,
      }))
    );

    // Reset UI immediately
    setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setRetourMode(false); setLiveDbLogs([]);
    lastCoatLookupRef.current = null;
    if (onNavigateToOpen) {
      onNavigateToOpen();
    } else {
      setPhase('input'); setActiveField('coat');
    }

    // Fire-and-forget DB writes
    (async () => {
      try {
        // Insert positive items
        if (logs.length > 0) await addDrinkLogs.mutateAsync(logs);
        // Delete negative items (retours) from DB
        for (const item of negativeItems) {
          const deleteCount = Math.abs(item.quantity);
          for (let i = 0; i < deleteCount; i++) {
            const { data: logToDelete } = await supabase
              .from('drink_logs')
              .select('id')
              .eq('session_id', sid)
              .eq('product_id', item.product.id)
              .limit(1)
              .maybeSingle();
            if (logToDelete) {
              await supabase.from('drink_logs').delete().eq('id', logToDelete.id);
            }
          }
        }
        await updateSession.mutateAsync({ id: sid, total_amount: newTotal });
        await unlockSession(sid);
      } catch {
        toast.error('Opslaan mislukt — probeer opnieuw');
      }
    })();
  }, [items, sessionId, sessionTotal, total, addDrinkLogs, updateSession, unlockSession, onNavigateToOpen]);

  const popupOrderLines: OrderLine[] = useMemo(() => {
    // Merge already-booked DB items with new local items so PAY popup shows the latest selections
    const merged = new Map<string, { name: string; qty: number }>();
    for (const l of liveDbLogs) {
      merged.set(l.product_id, { name: l.product_name, qty: l.quantity });
    }
    for (const i of items) {
      const existing = merged.get(i.product.id);
      if (existing) existing.qty += i.quantity;
      else merged.set(i.product.id, { name: i.product.full_name, qty: i.quantity });
    }
    return Array.from(merged.values())
      .filter((l) => l.qty !== 0)
      .map((l) => ({ name: l.name, qty: l.qty, price: 0 }));
  }, [liveDbLogs, items]);

  const executePayVerwerk = useCallback(async () => {
    if (!sessionId) return;
    setShowPayDialog(false);
    setShowEntreeWarning(false);
    try {
      // Save new items to DB before marking paid
      if (items.length > 0) {
        const logs = items.flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            session_id: sessionId,
            product_id: item.product.id,
            price_at_time: item.product.price,
          }))
        );
        await addDrinkLogs.mutateAsync(logs);
        await updateSession.mutateAsync({
          id: sessionId,
          status: 'paid',
          total_amount: sessionTotal + total,
        });
      } else {
        await updateSession.mutateAsync({ id: sessionId, status: 'paid' });
      }
      await unlockSession(sessionId);
      clearOrder();
      setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setRetourMode(false); setLiveDbLogs([]);
      lastCoatLookupRef.current = null;
      if (onNavigateToOpen) {
        onNavigateToOpen();
      } else {
        setPhase('input'); setActiveField('coat');
      }
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [sessionId, items, total, sessionTotal, updateSession, unlockSession, onNavigateToOpen, addDrinkLogs]);

  const handlePayVerwerk = useCallback(() => {
    if (!sessionId) return;
    setShowPayDialog(false);
    setShowEntreeWarning(true);
  }, [sessionId]);

  // Core save & cleanup logic (no navigation)
  const saveAndCleanupState = useCallback(() => {
    const sid = sessionId;
    const hasItems = sid && items.length > 0;
    const newTotal = Math.max(0, sessionTotal + total);
    const positiveItems = items.filter(i => i.quantity > 0);
    const negativeItems = items.filter(i => i.quantity < 0);
    const logs = hasItems
      ? positiveItems.flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            session_id: sid!,
            product_id: item.product.id,
            price_at_time: item.product.price,
          }))
        )
      : [];

    // Reset state immediately
    setCoatNumber(''); setItems([]); setSessionId(null); setSessionTotal(0); setExistingLogs([]); setRetourMode(false); clearOrder(); setLiveDbLogs([]);
    lastCoatLookupRef.current = null;

    // Fire-and-forget DB writes
    if (sid) {
      (async () => {
        try {
          if (logs.length > 0) await addDrinkLogs.mutateAsync(logs);
          // Delete negative items (retours) from DB
          for (const item of negativeItems) {
            const deleteCount = Math.abs(item.quantity);
            for (let i = 0; i < deleteCount; i++) {
              const { data: logToDelete } = await supabase
                .from('drink_logs')
                .select('id')
                .eq('session_id', sid)
                .eq('product_id', item.product.id)
                .limit(1)
                .maybeSingle();
              if (logToDelete) {
                await supabase.from('drink_logs').delete().eq('id', logToDelete.id);
              }
            }
          }
          if (hasItems) await updateSession.mutateAsync({ id: sid, total_amount: newTotal });
          await unlockSession(sid);
        } catch {
          toast.error('Opslaan mislukt — probeer opnieuw');
        }
      })();
    }
  }, [sessionId, items, total, sessionTotal, unlockSession, addDrinkLogs, updateSession]);

  // Reset to input screen (used by NEXT button and inactivity timer)
  const resetToInput = useCallback(() => {
    saveAndCleanupState();
    if (onNavigateToOpen) {
      onNavigateToOpen();
    } else {
      setPhase('input'); setActiveField('coat');
    }
  }, [saveAndCleanupState, onNavigateToOpen]);

  // Expose cleanup for parent (tab switching)
  useImperativeHandle(ref, () => ({
    saveAndCleanup: saveAndCleanupState,
  }), [saveAndCleanupState]);

  // 20s inactivity timer: reset to input when idle in products phase
  // Pause timer when any popup/dialog is open
  const anyPopupOpen = showLockedWarning || showClosedBlockDialog || showBonDialog || showPayDialog || showEntreeWarning || showTransferNumpad || showTransferConfirm;
  useInactivityTimer(phase === 'products' && !anyPopupOpen, resetToInput);

  const bonDialog = (
    <SessionPopup
      open={showBonDialog}
      onClose={() => setShowBonDialog(false)}
      title="Bestelling"
      subtitle={formatWardrobeNumber(coatNumber)}
      orderLines={popupOrderLines}
      showTotal={false}
      showItemCount
      actions={[
        { label: 'CANCEL', onClick: () => setShowBonDialog(false), variant: 'cancel' },
        { label: 'VERWERK', onClick: () => { setShowBonDialog(false); handleSubmit(); }, variant: 'confirm' },
      ]}
    />
  );

  const payDialog = (
    <SessionPopup
      open={showPayDialog}
      onClose={() => setShowPayDialog(false)}
      title="Bestelling"
      subtitle={formatWardrobeNumber(coatNumber)}
      orderLines={popupOrderLines}
      showTotal={false}
      showItemCount
      actions={[
        { label: 'CANCEL', onClick: () => setShowPayDialog(false), variant: 'cancel' },
        { label: 'VERWERK', onClick: handlePayVerwerk, variant: 'confirm' },
      ]}
    />
  );

  const entreeWarningDialog = (
    <SessionPopup
      open={showEntreeWarning}
      onClose={() => setShowEntreeWarning(false)}
      title="Let op"
      subtitle="Weet je zeker dat je niets bent vergeten?"
      orderLines={[]}
      showTotal={false}
      actions={[
        { label: 'TERUG', onClick: () => { setShowEntreeWarning(false); }, variant: 'cancel' },
        { label: 'VERDER', onClick: () => { executePayVerwerk(); }, variant: 'confirm' },
      ]}
    />
  );

  const handleClosedBlockDismiss = useCallback(() => {
    setShowClosedBlockDialog(false);
    setPendingWardrobe(null);
    setCoatNumber('');
    setActiveField('coat');
    lastCoatLookupRef.current = null;
  }, []);

  const closedBlockDialog = (
    <SessionPopup
      open={showClosedBlockDialog}
      onClose={handleClosedBlockDismiss}
      title={`Nummer ${formatWardrobeNumber(pendingWardrobe)} Geblokkeerd`}
      subtitle="Dit nummer is al afgerekend en gesloten. Vraag een manager om deze te heropenen via het Admin paneel."
      subtitleSize="clamp(0.85rem, 2vw, 1.15rem)"
      orderLines={[]}
      showTotal={false}
      actions={[
        { label: 'BEGREPEN', onClick: handleClosedBlockDismiss, variant: 'confirm' as const },
      ]}
    />
  );

  const handleLockedDismiss = useCallback(() => {
    setShowLockedWarning(false);
    setCoatNumber('');
    setActiveField('coat');
    lastCoatLookupRef.current = null;
  }, []);

  const lockedWarningDialog = (
    <Dialog open={showLockedWarning} onOpenChange={(open) => { if (!open) handleLockedDismiss(); }}>
      <DialogContent className="bg-card flex flex-col items-center gap-4 py-8" style={{ borderColor: '#ef444440', borderRadius: 12, maxWidth: 360 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px #ef444480' }}>
          <AlertCircle className="w-12 h-12 text-white" />
        </div>
        <p className="text-center font-extrabold text-lg px-4" style={{ color: '#ef4444' }}>
          Let op: Een andere medewerker is momenteel bezig met deze gast.
        </p>
        <button onClick={handleLockedDismiss} className="w-full max-w-[200px] py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 6 }}>OK</button>
      </DialogContent>
    </Dialog>
  );

  const handleTransferKey = useCallback((key: string) => {
    setTransferWarning(null);
    if (key === 'DEL') { setTransferNumber(''); return; }
    if (key === 'BACK') { setTransferNumber(prev => prev.slice(0, -1)); return; }
    if (transferNumber.length < 3) setTransferNumber(prev => prev + key);
  }, [transferNumber]);

  const handleOpenTransfer = useCallback(async () => {
    if (!sessionId) return;
    if (items.length > 0) {
      const positiveItems = items.filter(i => i.quantity > 0);
      const negativeItems = items.filter(i => i.quantity < 0);
      const logs = positiveItems.flatMap(item =>
        Array.from({ length: item.quantity }, () => ({
          session_id: sessionId,
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );
      try {
        if (logs.length > 0) await addDrinkLogs.mutateAsync(logs);
        for (const item of negativeItems) {
          const deleteCount = Math.abs(item.quantity);
          for (let i = 0; i < deleteCount; i++) {
            const { data: logToDelete } = await supabase
              .from('drink_logs').select('id')
              .eq('session_id', sessionId)
              .eq('product_id', item.product.id)
              .limit(1).maybeSingle();
            if (logToDelete) await supabase.from('drink_logs').delete().eq('id', logToDelete.id);
          }
        }
        const newTotal = Math.max(0, sessionTotal + total);
        await updateSession.mutateAsync({ id: sessionId, total_amount: newTotal });
        setItems([]);
        setSessionTotal(newTotal);
      } catch {
        toast.error('Opslaan mislukt voor transfer');
        return;
      }
    }
    setTransferNumber('');
    setTransferWarning(null);
    setShowTransferNumpad(true);
  }, [sessionId, items, sessionTotal, total, addDrinkLogs, updateSession]);

  const handleTransferConfirmOpen = useCallback(async () => {
    const newNum = transferNumber.trim();
    if (newNum.length === 0) { setTransferWarning('Voer een nieuw nummer in!'); return; }
    if (newNum === coatNumber) { setTransferWarning('Dit is al het huidige nummer!'); return; }
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
  }, [transferNumber, coatNumber, qc]);

  const executeTransfer = useCallback(async () => {
    if (!sessionId) return;
    const newNum = transferNumber.trim();
    setTransferLoading(true);
    try {
      await supabase.from('sessions').update({ wardrobe_number: newNum } as any).eq('id', sessionId);
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
      setShowTransferConfirm(false);
      setTransferNumber('');
      setCoatNumber(newNum);
      lastCoatLookupRef.current = newNum;
      
    } catch (err: any) {
      toast.error(`Transfer mislukt: ${err.message}`);
    } finally {
      setTransferLoading(false);
    }
  }, [sessionId, transferNumber, qc]);

  const handleTransferCancel = useCallback(() => {
    setShowTransferNumpad(false);
    setShowTransferConfirm(false);
    setTransferNumber('');
    setTransferWarning(null);
    setTransferLoading(false);
  }, []);

  const transferConfirmDialog = (
    <SessionPopup
      open={showTransferConfirm}
      onClose={handleTransferCancel}
      title="TRANSFER NR"
      subtitle={`Nummer ${formatWardrobeNumber(coatNumber)} overdragen naar ${formatWardrobeNumber(transferNumber)}. Weet je het zeker?`}
      subtitleSize="clamp(0.85rem, 2vw, 1.15rem)"
      orderLines={[]}
      showTotal={false}
      actions={[
        { label: 'NEE', onClick: handleTransferCancel, variant: 'cancel' as const },
        { label: transferLoading ? 'BEZIG...' : 'JA', onClick: executeTransfer, variant: 'confirm' as const },
      ]}
    />
  );

  const addAndBook = useCallback(async (product: DbProduct) => {
    if (!sessionId) return;

    // RETOUR MODE: add a negative entry to the new order (ledger-style)
    if (retourMode) {
      // Check the product exists somewhere (new items or existing logs) to retour
      const inItems = items.find((i) => i.product.id === product.id);
      const inExisting = existingLogs.find((l) => l.product_id === product.id);
      if (!inItems && !inExisting) return;

      // Calculate max retourable: existing DB quantity minus already-negative local entries
      const existingQty = inExisting?.quantity ?? 0;
      const currentLocalQty = inItems?.quantity ?? 0;
      // If local qty is already negative, that's how many retours we've already booked
      // If local qty is positive, we can retour those too
      const maxRetourable = existingQty + Math.max(0, currentLocalQty);
      const alreadyRetouredLocal = Math.abs(Math.min(0, currentLocalQty));
      if (alreadyRetouredLocal >= maxRetourable) return; // can't retour more than exists

      setRetourFlash(product.id);
      setTimeout(() => setRetourFlash(null), 600);

      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          // Decrease quantity (can go negative for retour entries)
          return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i)
            .filter((i) => i.quantity !== 0); // remove if hits zero
        }
        // Add new negative entry
        return [{ product, quantity: -1 }, ...prev];
      });

      setRetourMode(false);
      return;
    }

    // NORMAL MODE: add product to local newItems only (saved on NEXT)
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [{ product, quantity: 1 }, ...prev];
    });
  }, [sessionId, sessionTotal, updateSession, retourMode, items, existingLogs]);


  if (phase === 'input') {
    return (
      <div className="bg-black w-full h-full flex-1 overflow-hidden flex items-center justify-center relative">
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <img src="/placeholder.svg" alt="" className="object-cover w-full h-full opacity-10" />
        </div>
        <FeedbackOverlay type={feedback} />
        {closedBlockDialog}
        {lockedWarningDialog}
        {bonDialog}
        {payDialog}
        {entreeWarningDialog}

        <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
          <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
          <div className="flex items-center justify-center w-full">
            <div className="w-full" style={{ maxWidth: '280px' }}>
              <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: '3px solid #00cc13', boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                {formatWardrobeNumber(coatNumber) || <span style={{ color: '#9ca3af' }}>—</span>}
              </div>
            </div>
          </div>
          <NumPad onKey={handleNumKey} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden h-full relative" style={{ ...(retourMode ? { border: '4px solid #ef4444', boxShadow: 'inset 0 0 30px rgba(239,68,68,0.15)' } : {}) }}>
      <FeedbackOverlay type={feedback} />
      {closedBlockDialog}
      {lockedWarningDialog}
      {bonDialog}
      {payDialog}
      {entreeWarningDialog}
      {transferConfirmDialog}

      {/* Retour mode banner */}
      {retourMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: '#ef4444', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>
          ⚠ RETOUR MODUS ACTIEF ⚠
        </div>
      )}

      {/* Left column - 20% - Guest overview */}
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden" style={{ width: '20%', backgroundColor: retourMode ? '#1a0a0a' : '#121212', borderRight: `1px solid ${retourMode ? '#ef4444' : '#333'}`, transition: 'background-color 0.3s ease' }}>
        <div className="text-center py-3 border-b" style={{ borderColor: '#333' }}>
          <span className="font-extrabold" style={{ color: '#00ff00', fontSize: 'clamp(32px, 6vw, 56px)' }}>
            {formatWardrobeNumber(coatNumber) || ''}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
          {/* Nieuwe Bestelling section */}
          {items.length > 0 && (
            <>
              <div className="text-center py-1" style={{ borderBottom: '1px solid #333' }}>
                <span className="font-extrabold uppercase" style={{ color: '#00cc13', fontSize: 'clamp(9px, 1.4vw, 14px)', letterSpacing: '0.1em' }}>Nieuwe Bestelling</span>
              </div>
              {items.map((item) => {
                const isRetour = item.quantity < 0;
                return (
                  <div key={`new-${item.product.id}`} style={{ color: isRetour ? '#ef4444' : '#00cc13', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', fontWeight: 800 }}>
                    {isRetour ? `−${Math.abs(item.quantity)}` : item.quantity} x {item.product.full_name}
                  </div>
                );
              })}
            </>
          )}

          {/* Reeds Besteld section */}
          {liveDbLogs.length > 0 && (
            <>
              <div className="text-center py-1" style={{ borderBottom: '1px solid #333', marginTop: items.length > 0 ? '8px' : '0' }}>
                <span className="font-extrabold uppercase" style={{ color: '#888', fontSize: 'clamp(9px, 1.4vw, 14px)', letterSpacing: '0.1em' }}>Reeds Besteld</span>
              </div>
              {liveDbLogs.map((item) => (
                <div key={`existing-${item.product_id}`} style={{ color: '#e5e5e5', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', fontWeight: 400, ...(retourFlash === item.product_id ? { backgroundColor: '#ef444440', transform: 'scale(0.95)' } : {}) }}>
                  {retourFlash === item.product_id && <span style={{ color: '#ef4444', marginRight: 4 }}>−</span>}
                  {item.quantity} x {item.product_name}
                </div>
              ))}
            </>
          )}

          {items.length === 0 && liveDbLogs.length === 0 && (
            <div className="text-center py-4" style={{ color: '#555', fontSize: 'clamp(10px, 1.2vw, 14px)' }}>Geen producten</div>
          )}
        </div>

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

      </div>

      {/* Right column - Product grid */}
      <div className="flex flex-col overflow-hidden" style={{ width: '80%' }}>
        <ProductGrid
          onAddProduct={addAndBook}
          onPay={() => setShowPayDialog(true)}
          onToggleRetour={() => setRetourMode((m) => !m)}
          onNext={() => resetToInput()}
          retourMode={retourMode}
        />
      </div>

      {showTransferNumpad && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
            <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#ef4444' }}>TRANSFER NR</h2>
            <p className="text-sm font-bold uppercase text-center" style={{ color: '#888' }}>
              Huidig: <span style={{ color: '#fff' }}>{formatWardrobeNumber(coatNumber)}</span>{' → '}Nieuw nummer:
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
    </div>
  );
});
