import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const useClosedSessions = () => {
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
    refetchInterval: 5000,
  });
};

const ClosedPage = () => {
  const { data: sessions, isLoading } = useClosedSessions();
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const sortedSessions = (sessions ?? [])
    .filter((s) => s.wardrobe_number)
    .sort((a, b) => {
      const numA = parseInt((a.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const getOrderLines = (session: any) => {
    const logs: any[] = session.drink_logs ?? [];
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
        CLOSED
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
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {sortedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="flex items-center justify-center font-extrabold uppercase transition-all active:scale-95"
                style={{
                  backgroundColor: '#7f1d1d',
                  borderRadius: '12px',
                  padding: '20px 4px',
                  color: '#fff',
                  boxShadow: '0 0 12px #7f1d1d80',
                }}
              >
                <span style={{ fontSize: 'clamp(1.2rem, 4vw, 3rem)', lineHeight: 1 }}>{session.wardrobe_number?.replace(/\D/g, '')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="bg-card max-w-sm" style={{ borderColor: '#00cc1340' }}>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>
              {selectedSession?.wardrobe_number}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Status: {selectedSession?.status}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 mt-2">
            {selectedSession && getOrderLines(selectedSession).map((line, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-foreground">{line.qty}× {line.name}</span>
                <span className="text-muted-foreground">€{(line.qty * line.price).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-extrabold text-base mt-3 pt-2" style={{ borderTop: '1px solid #333' }}>
            <span style={{ color: '#00cc13' }}>TOTAAL</span>
            <span style={{ color: '#00cc13' }}>€{Number(selectedSession?.total_amount ?? 0).toFixed(2)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { ClosedPage };
