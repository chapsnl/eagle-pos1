import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionPopup, OrderLine } from '@/components/pos/SessionPopup';

const useClosedSessions = () => {
  const qc = useQueryClient();

  // Realtime: invalidate on drink_logs or sessions changes
  useEffect(() => {
    const channel = supabase
      .channel('closed-sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drink_logs' },
        () => { qc.invalidateQueries({ queryKey: ['closed-sessions'] }); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => { qc.invalidateQueries({ queryKey: ['closed-sessions'] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
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
    refetchInterval: 10000,
  });
};

const ClosedPage = () => {
  const { data: sessions, isLoading } = useClosedSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Derive selected session from live query data
  const selectedSession = selectedSessionId
    ? (sessions ?? []).find((s) => s.id === selectedSessionId) ?? null
    : null;

  const sortedSessions = (sessions ?? [])
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
      if (existing) {
        existing.qty += 1;
      } else {
        map.set(key, { name, qty: 1, price: log.price_at_time });
      }
    }
    return Array.from(map.values());
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <h2
        className="text-xl font-extrabold uppercase tracking-[0.15em] text-center py-3"
        style={{ color: '#00cc13' }}
      >
        OVERZICHT - AFGESLOTEN SESSIES ({sortedSessions.length})
      </h2>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Laden...</p>
        </div>
      ) : sortedSessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Geen afgesloten sessies</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {sortedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className="flex items-center justify-center font-extrabold uppercase transition-all active:scale-95 aspect-square"
                style={{
                  backgroundColor: '#7f1d1d',
                  borderRadius: '12px',
                  padding: '4px',
                  color: '#fff',
                  boxShadow: '0 0 12px #7f1d1d80',
                }}
              >
                <span style={{ fontSize: 'clamp(0.9rem, 3vw, 2.5rem)', lineHeight: 1 }}>{session.wardrobe_number?.replace(/\D/g, '')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <SessionPopup
        open={!!selectedSession}
        onClose={() => setSelectedSessionId(null)}
        title={selectedSession?.wardrobe_number ?? ''}
        subtitle={`Status: ${selectedSession?.status ?? ''}`}
        orderLines={selectedSession ? getOrderLines(selectedSession) : []}
        showTotal={false}
        totalAmount={Number(selectedSession?.total_amount ?? 0)}
        showItemCount
      />
    </div>
  );
};

export { ClosedPage };
