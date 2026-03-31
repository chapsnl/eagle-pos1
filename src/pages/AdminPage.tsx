import { useState, useEffect, useCallback } from 'react';
import { useActiveSessions, useUpdateSession } from '@/hooks/useSessions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    refetchInterval: 5000,
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
  const logs: any[] = session.drink_logs ?? [];
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

  // KPI calculations
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
                {sortedActive.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSession(s); setSelectedType('active'); }}
                    className="flex items-center justify-center font-extrabold transition-all active:scale-95"
                    style={{
                      backgroundColor: '#00cc13',
                      borderRadius: '12px',
                      padding: '14px 4px',
                      color: '#fff',
                      boxShadow: '0 0 12px #00cc1380',
                    }}
                  >
                    <span style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', lineHeight: 1 }}>
                      {s.wardrobe_number?.replace(/\D/g, '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Closed Sessions */}
        <div className="flex flex-col overflow-hidden rounded-[12px]" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #333' }}>
            <h3 className="text-sm font-extrabold uppercase" style={{ color: '#00cc13' }}>
              Afgesloten Klanten
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
                      {s.wardrobe_number?.replace(/\D/g, '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close Shift Button */}
      <button
        onClick={() => setCloseShiftStep(1)}
        className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px] transition-all active:scale-[0.98]"
        style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
      >
        CLOSE SHIFT
      </button>

      {/* Session Detail Popup */}
      <SessionPopup
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession?.wardrobe_number ?? ''}
        subtitle={selectedType === 'active' ? 'Actieve sessie' : `Status: ${selectedSession?.status ?? ''}`}
        orderLines={selectedSession ? getOrderLines(selectedSession) : []}
        showTotal={true}
        showPrices={true}
        totalAmount={Number(selectedSession?.total_amount ?? 0)}
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
              Hoe wil je sessie {reopenSession?.wardrobe_number?.replace(/\D/g, '') ?? ''} heropenen?
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
    </div>
  );
};
