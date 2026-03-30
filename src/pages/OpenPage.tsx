import { useState } from 'react';
import { useActiveSessions } from '@/hooks/useSessions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface OpenPageProps {
  onNavigateToGuest?: (wardrobeNumber: string) => void;
}

const OpenPage = ({ onNavigateToGuest }: OpenPageProps) => {
  const { data: sessions, isLoading } = useActiveSessions();
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Sort sessions numerically by wardrobe_number
  const sortedSessions = (sessions ?? [])
    .filter((s) => s.wardrobe_number)
    .sort((a, b) => {
      const numA = parseInt((a.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  // Build order lines from drink_logs
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
        map.set(key, { name, qty: 1, price: Number(log.price_at_time) });
      }
    }
    return Array.from(map.values());
  };

  const handleBewerk = () => {
    if (!selectedSession?.wardrobe_number || !onNavigateToGuest) return;
    const num = selectedSession.wardrobe_number.replace(/\D/g, '');
    setSelectedSession(null);
    onNavigateToGuest(num);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#111' }}>
      <h2
        className="text-xl font-extrabold uppercase tracking-[0.15em] text-center py-3"
        style={{ color: '#00cc13' }}
      >
        OVERZICHT — ACTIEVE SESSIES
      </h2>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: '#555' }}>Laden...</span>
        </div>
      )}

      {!isLoading && sortedSessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: '#555' }}>Geen actieve sessies</span>
        </div>
      )}

      {!isLoading && sortedSessions.length > 0 && (
        <div
          className="flex-1 overflow-y-auto px-3 pb-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
          >
            {sortedSessions.map((session) => {
              const num = (session.wardrobe_number ?? '').replace(/\D/g, '');
              const totalAmount = Number(session.total_amount ?? 0);
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="flex items-center justify-center font-extrabold uppercase transition-all active:scale-95 aspect-square"
                  style={{
                    backgroundColor: '#00cc13',
                    borderRadius: '12px',
                    padding: '4px',
                    color: '#fff',
                    boxShadow: '0 0 12px #00cc1380',
                  }}
                >
                  <span style={{ fontSize: 'clamp(1.2rem, 4vw, 3rem)', lineHeight: 1 }}>{num}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Session detail modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent
          className="bg-card max-h-[80vh] flex flex-col"
          style={{ borderColor: '#00cc1340', borderRadius: '12px' }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-extrabold uppercase text-lg"
              style={{ color: '#00cc13' }}
            >
              Gast {(selectedSession?.wardrobe_number ?? '').replace(/\D/g, '')}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: '#888' }}>
              Bestelling overzicht
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2" style={{ maxHeight: '40vh' }}>
            {selectedSession && (() => {
              const lines = getOrderLines(selectedSession);
              if (lines.length === 0) {
                return <p className="text-center py-4" style={{ color: '#666' }}>Geen bestellingen</p>;
              }
              return (
                <div className="space-y-1">
                  {lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center px-3 py-2 font-bold"
                      style={{ backgroundColor: '#1a1a1a', borderRadius: '8px' }}
                    >
                      <span style={{ color: '#e5e5e5' }}>
                        {line.qty}× {line.name}
                      </span>
                      <span style={{ color: '#00cc13' }}>
                        €{(line.qty * line.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div
            className="flex justify-between items-center px-3 py-2 font-extrabold text-lg"
            style={{ borderTop: '2px solid #00cc1340' }}
          >
            <span style={{ color: '#e5e5e5' }}>TOTAAL</span>
            <span style={{ color: '#00cc13' }}>
              €{Number(selectedSession?.total_amount ?? 0).toFixed(2)}
            </span>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setSelectedSession(null)}
              className="flex-1 py-3 font-extrabold uppercase text-sm"
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '12px',
                boxShadow: '0 0 12px #ef444480',
              }}
            >
              CANCEL
            </button>
            <button
              onClick={handleBewerk}
              className="flex-1 py-3 font-extrabold uppercase text-sm"
              style={{
                backgroundColor: '#00cc13',
                color: '#fff',
                borderRadius: '12px',
                boxShadow: '0 0 12px #00cc1380',
              }}
            >
              BEWERK
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { OpenPage };
