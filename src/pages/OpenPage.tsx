import { useState } from 'react';
import { useActiveSessions } from '@/hooks/useSessions';
import { SessionPopup, OrderLine, SessionPopupAction } from '@/components/pos/SessionPopup';

interface OpenPageProps {
  onNavigateToGuest?: (wardrobeNumber: string, sessionId: string, totalAmount: number) => void;
}

const OpenPage = ({ onNavigateToGuest }: OpenPageProps) => {
  const { data: sessions, isLoading } = useActiveSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Derive selected session from live query data
  const selectedSession = selectedSessionId
    ? (sessions ?? []).find((s) => s.id === selectedSessionId) ?? null
    : null;

  // Sort sessions numerically by wardrobe_number
  const sortedSessions = (sessions ?? [])
    .filter((s) => s.wardrobe_number)
    .sort((a, b) => {
      const numA = parseInt((a.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  // Build order lines from drink_logs
  const getOrderLines = (session: any): OrderLine[] => {
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
    if (!selectedSession || !onNavigateToGuest) return;
    setSelectedSessionId(null);
    onNavigateToGuest(selectedSession.wardrobe_number ?? '', selectedSession.id, Number(selectedSession.total_amount ?? 0));
  };

  const popupActions: SessionPopupAction[] = [
    { label: 'CANCEL', onClick: () => setSelectedSessionId(null), variant: 'cancel' },
    { label: 'BEWERK', onClick: handleBewerk, variant: 'confirm' },
  ];

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
            style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}
          >
            {sortedSessions.map((session) => {
              const num = (session.wardrobe_number ?? '').replace(/\D/g, '');
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="flex items-center justify-center font-extrabold uppercase transition-all active:scale-95"
                  style={{
                    backgroundColor: '#00cc13',
                    borderRadius: '12px',
                    padding: '20px 4px',
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

      <SessionPopup
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={`Gast ${(selectedSession?.wardrobe_number ?? '').replace(/\D/g, '')}`}
        subtitle="Bestelling overzicht"
        orderLines={selectedSession ? getOrderLines(selectedSession) : []}
        actions={popupActions}
        showItemCount
      />
    </div>
  );
};

export { OpenPage };
