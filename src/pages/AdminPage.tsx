import { useState, useEffect, useCallback } from 'react';
import { useActiveSessions, useUpdateSession } from '@/hooks/useSessions';
import { NumPad } from '@/components/pos/NumPad';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUpdateStaffPin } from '@/hooks/useStaffPin';
import { formatWardrobeNumber } from '@/lib/utils';



const useClosedSessions = () =>
  useQuery({
    queryKey: ['closed-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, drink_logs(*, products(*))')
        .in('status', ['paid', 'archived'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });

const sortByWardrobe = (list: any[]) =>
  [...list]
    .filter((s) => s.wardrobe_number)
    .sort((a, b) => {
      const numA = parseInt((a.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

const getOrderLines = (session: any): OrderLine[] => {
  const logs: any[] = [...(session.drink_logs ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const map = new Map<string, { name: string; qty: number; price: number }>();
  for (const log of logs) {
    const name = log.products?.full_name ?? log.products?.shorthand ?? 'Onbekend';
    const key = log.product_id;
    const existing = map.get(key);
    if (existing) existing.qty += 1;
    else map.set(key, { name, qty: 1, price: log.price_at_time });
  }
  return Array.from(map.values());
};

interface AdminPageProps {
  onNavigateToGuest?: (wardrobeNumber: string, sessionId: string, totalAmount: number) => void;
}

export const AdminPage = ({ onNavigateToGuest }: AdminPageProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);

  const handleAdminKey = useCallback((key: string) => {
    if (pinChecking) return;
    setPinError(false);
    if (key === 'DEL') { setAdminPin(''); return; }
    if (key === 'BACK') { setAdminPin(prev => prev.slice(0, -1)); return; }
    setAdminPin(prev => prev.length >= 4 ? prev : prev + key);
  }, [pinChecking]);

  useEffect(() => {
    if (adminPin.length !== 4) return;
    setPinChecking(true);
    supabase.functions.invoke('verify-pin', {
      body: { pin: adminPin, type: 'admin' },
    }).then(({ data, error: fnError }) => {
      if (!fnError && data?.valid) {
        setIsAuthenticated(true);
      } else {
        setPinError(true);
        setAdminPin('');
      }
      setPinChecking(false);
    });
  }, [adminPin]);

  const { data: activeSessions } = useActiveSessions();
  const { data: closedSessions } = useClosedSessions();
  const updateSession = useUpdateSession();
  const qc = useQueryClient();

  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'active' | 'closed'>('active');
  const [closeShiftStep, setCloseShiftStep] = useState<0 | 1 | 2>(0);
  const [closeShiftLoading, setCloseShiftLoading] = useState(false);
  const [closeShiftResult, setCloseShiftResult] = useState<string | null>(null);
  const [reopenSession, setReopenSession] = useState<any>(null);

  // PIN change state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  // Bulk generate state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkActiveField, setBulkActiveField] = useState<'start' | 'end'>('start');

  // Delete single number state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteNumber, setDeleteNumber] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk delete range state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteStart, setBulkDeleteStart] = useState('');
  const [bulkDeleteEnd, setBulkDeleteEnd] = useState('');
  const [bulkDeleteActiveField, setBulkDeleteActiveField] = useState<'start' | 'end'>('start');
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkDeleteConfirmStep, setBulkDeleteConfirmStep] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const updateStaffPin = useUpdateStaffPin();

  

  const handlePinChangeKey = useCallback((key: string) => {
    if (pinSaving) return;
    setPinChangeError('');
    if (pinStep === 'enter') {
      if (key === 'DEL') { setNewPin(''); return; }
      if (key === 'BACK') { setNewPin(prev => prev.slice(0, -1)); return; }
      setNewPin(prev => prev.length >= 6 ? prev : prev + key);
    } else {
      if (key === 'DEL') { setConfirmPin(''); return; }
      if (key === 'BACK') { setConfirmPin(prev => prev.slice(0, -1)); return; }
      setConfirmPin(prev => prev.length >= 6 ? prev : prev + key);
    }
  }, [pinStep, pinSaving]);

  useEffect(() => {
    if (newPin.length === 6 && pinStep === 'enter') {
      setPinStep('confirm');
    }
  }, [newPin, pinStep]);

  useEffect(() => {
    if (confirmPin.length !== 6 || pinStep !== 'confirm' || pinSaving) return;
    if (confirmPin === newPin) {
      setPinSaving(true);
      updateStaffPin.mutate(confirmPin, {
        onSuccess: () => {
          setPinDialogOpen(false);
          setPinStep('enter');
          setNewPin('');
          setConfirmPin('');
          setPinChangeError('');
          setPinSaving(false);
        },
        onError: () => {
          setPinChangeError('Opslaan mislukt');
          setConfirmPin('');
          setPinSaving(false);
        },
      });
    } else {
      setPinChangeError('PINs komen niet overeen');
      setPinStep('enter');
      setNewPin('');
      setConfirmPin('');
    }
  }, [confirmPin, pinStep, newPin, pinSaving]);

  const handlePinDialogClose = () => {
    setPinDialogOpen(false);
    setPinStep('enter');
    setNewPin('');
    setConfirmPin('');
    setPinChangeError('');
    setPinSaving(false);
  };


  // KPI calculations - based on total_amount (no drink_logs needed)
  const nogTeOntvangen = (activeSessions ?? []).reduce(
    (sum, s) => sum + Number(s.total_amount ?? 0), 0
  );
  const reedsOntvangen = (closedSessions ?? []).reduce(
    (sum, s) => sum + Number(s.total_amount ?? 0), 0
  );
  const verwachtTotaal = nogTeOntvangen + reedsOntvangen;

  const sortedActive = sortByWardrobe(activeSessions ?? []);
  const sortedClosed = sortByWardrobe(closedSessions ?? []);

  const handleReopenKeep = useCallback(async (session: any) => {
    try {
      await updateSession.mutateAsync({ id: session.id, status: 'active' });
      qc.invalidateQueries({ queryKey: ['closed-sessions'] });
      setReopenSession(null);
      setSelectedSession(null);
    } catch { /* ignore */ }
  }, [updateSession, qc]);

  const handleReopenEmpty = useCallback(async (session: any) => {
    try {
      // Delete all drink_logs for this session
      await supabase.from('drink_logs').delete().eq('session_id', session.id);
      // Reset to active with 0 total
      await updateSession.mutateAsync({ id: session.id, status: 'active', total_amount: 0 });
      qc.invalidateQueries({ queryKey: ['closed-sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      setReopenSession(null);
      setSelectedSession(null);
    } catch { /* ignore */ }
  }, [updateSession, qc]);

  const handleCloseShift = useCallback(async () => {
    setCloseShiftLoading(true);
    try {
      const { error } = await supabase.functions.invoke('close-shift');
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
      qc.invalidateQueries({ queryKey: ['closed-sessions'] });
      setCloseShiftResult('Shift afgesloten en data gewist!');
    } catch (err: any) {
      setCloseShiftResult(`Fout: ${err.message}`);
    } finally {
      setCloseShiftLoading(false);
    }
  }, [qc]);

  const kpis = [
    { label: 'Nog te ontvangen', value: nogTeOntvangen },
    { label: 'Reeds ontvangen', value: reedsOntvangen },
    { label: 'Verwacht Totaal', value: verwachtTotaal },
  ];

  if (!isAuthenticated) {
    return (
      <div className="bg-black w-full h-full flex-1 flex overflow-hidden items-center justify-center relative">
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <img src="/placeholder.svg" alt="" className="object-cover w-full h-full opacity-10" />
        </div>
        <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
          <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#00cc13' }}>ADMIN PIN</h2>
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border-2 transition-all duration-150"
                style={{
                  borderColor: pinError ? '#ef4444' : '#00cc13',
                  backgroundColor: i < adminPin.length ? (pinError ? '#ef4444' : '#00cc13') : 'transparent',
                }}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>Onjuiste PIN</p>
          )}
          <NumPad onKey={handleAdminKey} disabled={pinChecking} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0" style={{ backgroundColor: '#1a1a1a' }}>
            <CardContent className="p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#888' }}>
                {kpi.label}
              </p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: '#00cc13' }}>
                €{kpi.value.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Management - Two Columns */}
      <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden min-h-0">
        {/* Left: Active Sessions */}
        <div className="flex flex-col overflow-hidden rounded-[12px]" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #333' }}>
            <h3 className="text-sm font-extrabold uppercase" style={{ color: '#00cc13' }}>
              Actieve Sessies
            </h3>
            <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
              {sortedActive.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sortedActive.length === 0 ? (
              <p className="text-center py-4 text-sm" style={{ color: '#666' }}>Geen actieve sessies</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {sortedActive.map((s) => {
                  const hasItems = Number(s.total_amount ?? 0) > 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSession(s); setSelectedType('active'); }}
                      className="flex items-center justify-center font-extrabold transition-all active:scale-95"
                      style={{
                        backgroundColor: hasItems ? '#00cc13' : '#1a5c1a',
                        borderRadius: '12px',
                        padding: '14px 4px',
                        color: hasItems ? '#fff' : '#88aa88',
                        boxShadow: hasItems ? '0 0 12px #00cc1380' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', lineHeight: 1 }}>
                        {formatWardrobeNumber(s.wardrobe_number)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Closed Sessions */}
        <div className="flex flex-col overflow-hidden rounded-[12px]" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #333' }}>
            <h3 className="text-sm font-extrabold uppercase" style={{ color: '#00cc13' }}>
              Afgesloten Sessies
            </h3>
            <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
              {sortedClosed.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sortedClosed.length === 0 ? (
              <p className="text-center py-4 text-sm" style={{ color: '#666' }}>Geen afgesloten sessies</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {sortedClosed.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSession(s); setSelectedType('closed'); }}
                    className="flex items-center justify-center font-extrabold transition-all active:scale-95"
                    style={{
                      backgroundColor: '#7f1d1d',
                      borderRadius: '12px',
                      padding: '14px 4px',
                      color: '#fff',
                      boxShadow: '0 0 12px #7f1d1d80',
                    }}
                  >
                    <span style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', lineHeight: 1 }}>
                      {formatWardrobeNumber(s.wardrobe_number)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setPinDialogOpen(true)}
          className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          PIN WIJZIGEN
        </button>
        <button
          onClick={() => { setBulkOpen(true); setBulkStart(''); setBulkEnd(''); setBulkError(''); setBulkActiveField('start'); }}
          className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          GENEREER NUMMERS
        </button>
        <button
          onClick={() => { setDeleteOpen(true); setDeleteNumber(''); setDeleteError(''); setDeleteConfirmStep(false); }}
          className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          VERWIJDER NUMMER
        </button>
        <button
          onClick={() => { setBulkDeleteOpen(true); setBulkDeleteStart(''); setBulkDeleteEnd(''); setBulkDeleteError(''); setBulkDeleteConfirmStep(false); setBulkDeleteActiveField('start'); }}
          className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          VERWIJDER REEKS
        </button>
        <button
          onClick={() => setCloseShiftStep(1)}
          className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          CLOSE SHIFT
        </button>
      </div>

      {/* Session Detail Popup */}
      <SessionPopup
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={formatWardrobeNumber(selectedSession?.wardrobe_number)}
        subtitle={selectedType === 'active' ? 'Actieve sessie' : `Status: ${selectedSession?.status ?? ''}`}
        orderLines={selectedSession ? getOrderLines(selectedSession) : []}
        showTotal={true}
        showPrices={true}
        totalAmount={selectedSession ? getOrderLines(selectedSession).reduce((sum, l) => sum + l.qty * l.price, 0) : 0}
        actions={
          selectedType === 'active'
            ? [
                { label: 'CANCEL', onClick: () => setSelectedSession(null), variant: 'cancel' as const },
                { label: 'BEWERK', onClick: () => {
                    if (selectedSession && onNavigateToGuest) {
                      const s = selectedSession;
                      setSelectedSession(null);
                      onNavigateToGuest(s.wardrobe_number ?? '', s.id, Number(s.total_amount ?? 0));
                    }
                  }, variant: 'confirm' as const },
              ]
            : [
                { label: 'CANCEL', onClick: () => setSelectedSession(null), variant: 'cancel' as const },
                { label: 'HEROPEN', onClick: () => { setReopenSession(selectedSession); setSelectedSession(null); }, variant: 'confirm' as const },
              ]
        }
      />

      {/* Close Shift Step 1: Show total + confirm */}
      <SessionPopup
        open={closeShiftStep === 1}
        onClose={() => setCloseShiftStep(0)}
        title="CLOSE SHIFT"
        subtitle={`Totaal ontvangen: €${reedsOntvangen.toFixed(2)}`}
        orderLines={[]}
        showTotal={false}
        actions={[
          { label: 'NEE', onClick: () => setCloseShiftStep(0), variant: 'cancel' as const },
          { label: 'JA', onClick: () => setCloseShiftStep(2), variant: 'confirm' as const },
        ]}
      />

      {/* Close Shift Step 2: Double safety check */}
      <SessionPopup
        open={closeShiftStep === 2 && !closeShiftResult}
        onClose={() => { if (!closeShiftLoading) setCloseShiftStep(0); }}
        title="CLOSE SHIFT"
        subtitle="Weet je het zeker?"
        orderLines={[]}
        showTotal={false}
        actions={[
          { label: 'NEE', onClick: () => setCloseShiftStep(0), variant: 'cancel' as const },
          {
            label: closeShiftLoading ? 'BEZIG...' : 'JA',
            onClick: handleCloseShift,
            variant: 'confirm' as const,
          },
        ]}
      />

      {/* Close Shift Result Popup */}
      <SessionPopup
        open={!!closeShiftResult}
        onClose={() => { setCloseShiftResult(null); setCloseShiftStep(0); }}
        title={closeShiftResult?.startsWith('Fout') ? 'FOUT' : 'SHIFT AFGESLOTEN'}
        subtitle={closeShiftResult ?? ''}
        orderLines={[]}
        showTotal={false}
        actions={[
          { label: 'OK', onClick: () => { setCloseShiftResult(null); setCloseShiftStep(0); }, variant: 'confirm' as const },
        ]}
      />

      {/* Reopen Session Popup - 3 options */}
      <Dialog open={!!reopenSession} onOpenChange={(o) => { if (!o) setReopenSession(null); }}>
        <DialogContent
          className="bg-card max-h-[80vh] flex flex-col"
          style={{ borderColor: '#00cc1340', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-extrabold uppercase text-lg"
              style={{ color: '#00cc13' }}
            >
              Sessie Heropenen
            </DialogTitle>
            <p className="font-bold" style={{ color: '#888', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)' }}>
              Hoe wil je sessie {formatWardrobeNumber(reopenSession?.wardrobe_number)} heropenen?
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={() => reopenSession && handleReopenKeep(reopenSession)}
              className="w-full py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380', borderRadius: 6 }}
            >
              BEHOUD BESTELLINGEN
            </button>
            <button
              onClick={() => reopenSession && handleReopenEmpty(reopenSession)}
              className="w-full py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380', borderRadius: 6 }}
            >
              BEGIN LEEG
            </button>
            <button
              onClick={() => setReopenSession(null)}
              className="w-full py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 6 }}
            >
              ANNULEER
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o) setBulkOpen(false); }}>
        <DialogContent
          className="bg-black max-w-sm"
          style={{ borderColor: '#ef444440', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl font-extrabold uppercase tracking-wider text-center"
              style={{ color: '#00cc13' }}
            >
              GENEREER NUMMERS
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBulkActiveField('start')}
                className="flex-1 flex flex-col gap-1 items-center"
              >
                <label className="text-xs font-bold uppercase" style={{ color: '#888' }}>Start Nummer</label>
                <div
                  className="w-full h-14 rounded-lg flex items-center justify-center text-3xl font-extrabold"
                  style={{
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: bulkActiveField === 'start' ? '2px solid #00cc13' : '1px solid #444',
                    boxShadow: bulkActiveField === 'start' ? '0 0 12px #00cc1340' : 'none',
                  }}
                >
                  {formatWardrobeNumber(bulkStart) || <span style={{ color: '#555' }}>—</span>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBulkActiveField('end')}
                className="flex-1 flex flex-col gap-1 items-center"
              >
                <label className="text-xs font-bold uppercase" style={{ color: '#888' }}>Eind Nummer</label>
                <div
                  className="w-full h-14 rounded-lg flex items-center justify-center text-3xl font-extrabold"
                  style={{
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: bulkActiveField === 'end' ? '2px solid #00cc13' : '1px solid #444',
                    boxShadow: bulkActiveField === 'end' ? '0 0 12px #00cc1340' : 'none',
                  }}
                >
                  {formatWardrobeNumber(bulkEnd) || <span style={{ color: '#555' }}>—</span>}
                </div>
              </button>
            </div>
            {bulkError && (
              <p className="text-sm text-center font-bold" style={{ color: '#ef4444' }}>{bulkError}</p>
            )}
            <NumPad onKey={(key) => {
              setBulkError('');
              const setter = bulkActiveField === 'start' ? setBulkStart : setBulkEnd;
              if (key === 'DEL') { setter(''); return; }
              if (key === 'BACK') { setter(prev => prev.slice(0, -1)); return; }
              setter(prev => prev.length >= 3 ? prev : prev + key);
            }} />
            <button
              disabled={bulkLoading || bulkStart.length !== 3 || bulkEnd.length !== 3}
              onClick={async () => {
                const s = parseInt(bulkStart, 10);
                const e = parseInt(bulkEnd, 10);
                if (isNaN(s) || isNaN(e)) { setBulkError('Vul beide velden in'); return; }
                if (e < s) { setBulkError('Eind nummer moet ≥ start nummer zijn'); return; }
                if (e - s + 1 > 500) { setBulkError('Maximaal 500 nummers tegelijk'); return; }
                setBulkLoading(true);
                setBulkError('');
                try {
                  // Check for existing active sessions in the range
                  const rangeNumbers = [];
                  for (let i = s; i <= e; i++) rangeNumbers.push(String(i));
                  const { data: existing, error: checkErr } = await supabase
                    .from('sessions')
                    .select('wardrobe_number')
                    .eq('status', 'active')
                    .in('wardrobe_number', rangeNumbers);
                  if (checkErr) throw checkErr;
                  if (existing && existing.length > 0) {
                    const nums = existing.map(s => formatWardrobeNumber(s.wardrobe_number)).join(', ');
                    setBulkError(`Let op: Nummer(s) ${nums} bestaan al. Doe eerst een 'Close Shift' of kies een andere reeks.`);
                    setBulkLoading(false);
                    return;
                  }
                  const rows = [];
                  for (let i = s; i <= e; i++) {
                    rows.push({ wardrobe_number: String(i), status: 'active' as const, total_amount: 0 });
                  }
                  const { error } = await supabase.from('sessions').insert(rows);
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ['sessions'] });
                  qc.invalidateQueries({ queryKey: ['active-sessions'] });
                  setBulkOpen(false);
                } catch (err: any) {
                  setBulkError(err.message ?? 'Er ging iets mis');
                } finally {
                  setBulkLoading(false);
                }
              }}
              className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] disabled:opacity-50"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
            >
              {bulkLoading ? 'BEZIG...' : 'AANMAKEN'}
            </button>
            <button
              onClick={() => setBulkOpen(false)}
              className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
              style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
            >
              ANNULEER
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Number Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); setDeleteConfirmStep(false); } }}>
        <DialogContent
          className="bg-black max-w-sm"
          style={{ borderColor: '#ef444440', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl font-extrabold uppercase tracking-wider text-center"
              style={{ color: '#00cc13' }}
            >
              VERWIJDER NUMMER
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {!deleteConfirmStep ? (
              <>
                <div className="flex flex-col gap-1 items-center">
                  <label className="text-xs font-bold uppercase" style={{ color: '#00cc13' }}>Te verwijderen gastnummer</label>
                  <div
                    className="w-full h-16 rounded-lg flex items-center justify-center text-4xl font-extrabold"
                    style={{
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      border: '2px solid #00cc13',
                      boxShadow: '0 0 12px #00cc1340',
                    }}
                  >
                    {formatWardrobeNumber(deleteNumber) || <span style={{ color: '#555' }}>—</span>}
                  </div>
                </div>
                {deleteError && (
                  <p className="text-sm text-center font-bold" style={{ color: '#ef4444' }}>{deleteError}</p>
                )}
                <NumPad onKey={(key) => {
                  setDeleteError('');
                  if (key === 'DEL') { setDeleteNumber(''); return; }
                  if (key === 'BACK') { setDeleteNumber(prev => prev.slice(0, -1)); return; }
                  setDeleteNumber(prev => prev.length >= 3 ? prev : prev + key);
                }} />
                <button
                  disabled={!deleteNumber.trim()}
                  onClick={() => {
                    if (!deleteNumber.trim()) { setDeleteError('Vul een nummer in'); return; }
                    setDeleteConfirmStep(true);
                  }}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
                >
                  VERWIJDEREN
                </button>
                <button
                  onClick={() => setDeleteOpen(false)}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                  style={{ backgroundColor: '#2a2a2a', color: '#00cc13', border: '1px solid #00cc1340' }}
                >
                  ANNULEER
                </button>
              </>
            ) : (
              <>
                <p className="text-center font-bold text-lg" style={{ color: '#fff' }}>
                  Weet je het zeker? Nummer <span style={{ color: '#ef4444' }}>{formatWardrobeNumber(deleteNumber)}</span> wordt definitief verwijderd.
                </p>
                {deleteError && (
                  <p className="text-sm text-center font-bold" style={{ color: '#ef4444' }}>{deleteError}</p>
                )}
                <button
                  onClick={() => { setDeleteConfirmStep(false); }}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                  style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
                >
                  CANCEL
                </button>
                <button
                  disabled={deleteLoading}
                  onClick={async () => {
                    const num = deleteNumber.trim();
                    setDeleteLoading(true);
                    setDeleteError('');
                    try {
                      const { data: session, error: findErr } = await supabase
                        .from('sessions')
                        .select('id')
                        .eq('wardrobe_number', num)
                        .eq('status', 'active')
                        .maybeSingle();
                      if (findErr) throw findErr;
                      if (!session) { setDeleteError(`Geen actieve sessie met nummer ${formatWardrobeNumber(num)}`); setDeleteLoading(false); return; }
                      await supabase.from('drink_logs').delete().eq('session_id', session.id);
                      const { error: delErr } = await supabase.from('sessions').delete().eq('id', session.id);
                      if (delErr) throw delErr;
                      qc.invalidateQueries({ queryKey: ['sessions'] });
                      qc.invalidateQueries({ queryKey: ['active-sessions'] });
                      setDeleteOpen(false);
                      setDeleteConfirmStep(false);
                      setDeleteNumber('');
                      const { toast } = await import('sonner');
                      toast.success(`Nummer ${formatWardrobeNumber(num)} succesvol verwijderd`);
                    } catch (err: any) {
                      setDeleteError(err.message ?? 'Er ging iets mis');
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
                >
                  {deleteLoading ? 'BEZIG...' : 'DOORGAAN'}
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Range Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => { if (!o) { setBulkDeleteOpen(false); setBulkDeleteConfirmStep(false); } }}>
        <DialogContent
          className="bg-black max-w-sm"
          style={{ borderColor: '#ef444440', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl font-extrabold uppercase tracking-wider text-center"
              style={{ color: '#00cc13' }}
            >
              VERWIJDER REEKS
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {!bulkDeleteConfirmStep ? (
              <>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteActiveField('start')}
                    className="flex-1 flex flex-col gap-1 items-center"
                  >
                    <label className="text-xs font-bold uppercase" style={{ color: '#888' }}>Van</label>
                    <div
                      className="w-full h-14 rounded-lg flex items-center justify-center text-3xl font-extrabold"
                      style={{
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: bulkDeleteActiveField === 'start' ? '2px solid #00cc13' : '1px solid #444',
                        boxShadow: bulkDeleteActiveField === 'start' ? '0 0 12px #00cc1340' : 'none',
                      }}
                    >
                      {formatWardrobeNumber(bulkDeleteStart) || <span style={{ color: '#555' }}>—</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteActiveField('end')}
                    className="flex-1 flex flex-col gap-1 items-center"
                  >
                    <label className="text-xs font-bold uppercase" style={{ color: '#888' }}>Tot</label>
                    <div
                      className="w-full h-14 rounded-lg flex items-center justify-center text-3xl font-extrabold"
                      style={{
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: bulkDeleteActiveField === 'end' ? '2px solid #00cc13' : '1px solid #444',
                        boxShadow: bulkDeleteActiveField === 'end' ? '0 0 12px #00cc1340' : 'none',
                      }}
                    >
                      {formatWardrobeNumber(bulkDeleteEnd) || <span style={{ color: '#555' }}>—</span>}
                    </div>
                  </button>
                </div>
                {bulkDeleteError && (
                  <p className="text-sm text-center font-bold" style={{ color: '#ef4444' }}>{bulkDeleteError}</p>
                )}
                <NumPad onKey={(key) => {
                  setBulkDeleteError('');
                  const setter = bulkDeleteActiveField === 'start' ? setBulkDeleteStart : setBulkDeleteEnd;
                  if (key === 'DEL') { setter(''); return; }
                  if (key === 'BACK') { setter(prev => prev.slice(0, -1)); return; }
                  setter(prev => prev.length >= 3 ? prev : prev + key);
                }} />
                <button
                  disabled={bulkDeleteStart.length !== 3 || bulkDeleteEnd.length !== 3}
                  onClick={async () => {
                    const s = parseInt(bulkDeleteStart, 10);
                    const e = parseInt(bulkDeleteEnd, 10);
                    if (isNaN(s) || isNaN(e)) { setBulkDeleteError('Vul beide velden in'); return; }
                    if (e < s) { setBulkDeleteError('Eind nummer moet ≥ start nummer zijn'); return; }
                    if (e - s + 1 > 500) { setBulkDeleteError('Maximaal 500 nummers tegelijk'); return; }
                    setBulkDeleteLoading(true);
                    setBulkDeleteError('');
                    try {
                      const rangeNumbers = [];
                      for (let i = s; i <= e; i++) rangeNumbers.push(String(i));
                      // Check for sessions with drink_logs (in use) or paid status
                      const { data: inUseSessions, error: checkErr } = await supabase
                        .from('sessions')
                        .select('wardrobe_number, status, drink_logs(id)')
                        .in('wardrobe_number', rangeNumbers)
                        .in('status', ['active', 'paid']);
                      if (checkErr) throw checkErr;
                      const blockedNumbers: string[] = [];
                      for (const sess of (inUseSessions ?? [])) {
                        const hasLogs = Array.isArray(sess.drink_logs) && sess.drink_logs.length > 0;
                        if (sess.status === 'paid') {
                          blockedNumbers.push(`${sess.wardrobe_number} (betaald)`);
                        } else if (hasLogs) {
                          blockedNumbers.push(`${sess.wardrobe_number} (in gebruik)`);
                        }
                      }
                      if (blockedNumbers.length > 0) {
                        setBulkDeleteError(`Kan niet verwijderen: ${blockedNumbers.join(', ')}`);
                        setBulkDeleteLoading(false);
                        return;
                      }
                      setBulkDeleteLoading(false);
                      setBulkDeleteConfirmStep(true);
                    } catch (err: any) {
                      setBulkDeleteError(err.message ?? 'Er ging iets mis');
                      setBulkDeleteLoading(false);
                    }
                  }}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
                >
                  {bulkDeleteLoading ? 'CONTROLEREN...' : 'VERWIJDEREN'}
                </button>
                <button
                  onClick={() => setBulkDeleteOpen(false)}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                  style={{ backgroundColor: '#2a2a2a', color: '#00cc13', border: '1px solid #00cc1340' }}
                >
                  ANNULEER
                </button>
              </>
            ) : (
              <>
                <p className="text-center font-bold text-lg" style={{ color: '#fff' }}>
                  Weet je het zeker? Nummers <span style={{ color: '#ef4444' }}>{formatWardrobeNumber(bulkDeleteStart)}</span> t/m <span style={{ color: '#ef4444' }}>{formatWardrobeNumber(bulkDeleteEnd)}</span> worden definitief verwijderd.
                </p>
                {bulkDeleteError && (
                  <p className="text-sm text-center font-bold" style={{ color: '#ef4444' }}>{bulkDeleteError}</p>
                )}
                <button
                  onClick={() => setBulkDeleteConfirmStep(false)}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                  style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
                >
                  CANCEL
                </button>
                <button
                  disabled={bulkDeleteLoading}
                  onClick={async () => {
                    const s = parseInt(bulkDeleteStart, 10);
                    const e = parseInt(bulkDeleteEnd, 10);
                    setBulkDeleteLoading(true);
                    setBulkDeleteError('');
                    try {
                      const rangeNumbers = [];
                      for (let i = s; i <= e; i++) rangeNumbers.push(String(i));
                      // Find all active empty sessions in range
                      const { data: sessions, error: findErr } = await supabase
                        .from('sessions')
                        .select('id')
                        .in('wardrobe_number', rangeNumbers)
                        .eq('status', 'active');
                      if (findErr) throw findErr;
                      if (!sessions || sessions.length === 0) {
                        setBulkDeleteError('Geen actieve sessies gevonden in deze reeks');
                        setBulkDeleteLoading(false);
                        return;
                      }
                      const sessionIds = sessions.map(ss => ss.id);
                      // Delete drink_logs just in case
                      await supabase.from('drink_logs').delete().in('session_id', sessionIds);
                      const { error: delErr } = await supabase.from('sessions').delete().in('id', sessionIds);
                      if (delErr) throw delErr;
                      qc.invalidateQueries({ queryKey: ['sessions'] });
                      qc.invalidateQueries({ queryKey: ['active-sessions'] });
                      setBulkDeleteOpen(false);
                      setBulkDeleteConfirmStep(false);
                      const { toast } = await import('sonner');
                      toast.success(`Nummers ${formatWardrobeNumber(bulkDeleteStart)} t/m ${formatWardrobeNumber(bulkDeleteEnd)} verwijderd (${sessions.length} sessies)`);
                    } catch (err: any) {
                      setBulkDeleteError(err.message ?? 'Er ging iets mis');
                    } finally {
                      setBulkDeleteLoading(false);
                    }
                  }}
                  className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
                >
                  {bulkDeleteLoading ? 'BEZIG...' : 'DOORGAAN'}
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Change Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(o) => { if (!o) handlePinDialogClose(); }}>
        <DialogContent
          className="bg-black max-w-sm"
          style={{ borderColor: '#00cc1340', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center"
              style={{ color: '#00cc13' }}
            >
              {pinStep === 'enter' ? 'NIEUWE PIN CODE' : 'BEVESTIG PIN'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
              {/* Dot indicators */}
              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const currentPin = pinStep === 'enter' ? newPin : confirmPin;
                  return (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border-2 transition-all duration-150"
                      style={{
                        borderColor: pinChangeError ? '#ef4444' : '#00cc13',
                        backgroundColor: i < currentPin.length ? (pinChangeError ? '#ef4444' : '#00cc13') : 'transparent',
                      }}
                    />
                  );
                })}
              </div>

              {pinChangeError && (
                <p className="text-sm text-center" style={{ color: '#ef4444' }}>{pinChangeError}</p>
              )}

              <NumPad onKey={handlePinChangeKey} disabled={pinSaving} />

              {/* Cancel button */}
              <button
                onClick={handlePinDialogClose}
                className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
              >
                ANNULEER
              </button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
