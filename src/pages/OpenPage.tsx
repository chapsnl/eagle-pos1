import { useActiveSessions } from '@/hooks/useSessions';
import { formatWardrobeNumber } from '@/lib/utils';

interface OpenPageProps {
  onNavigateToGuest?: (wardrobeNumber: string, sessionId: string, totalAmount: number) => void;
}

const OpenPage = ({ onNavigateToGuest }: OpenPageProps) => {
  const { data: sessions, isLoading } = useActiveSessions();

  const sortedSessions = (sessions ?? [])
    .filter((s) => s.wardrobe_number)
    .sort((a, b) => {
      const numA = parseInt((a.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.wardrobe_number ?? '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const handleClick = (session: any) => {
    if (!onNavigateToGuest) return;
    onNavigateToGuest(session.wardrobe_number ?? '', session.id, Number(session.total_amount ?? 0));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#111' }}>
      <h2
        className="text-xl font-extrabold uppercase tracking-[0.15em] text-center py-3"
        style={{ color: '#00cc13' }}
      >
        OVERZICHT — ACTIEVE SESSIES ({sortedSessions.length})
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
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {sortedSessions.map((session) => {
              const num = (session.wardrobe_number ?? '').replace(/\D/g, '');
              const hasItems = Number(session.total_amount ?? 0) > 0;
              return (
                <button
                  key={session.id}
                  onClick={() => handleClick(session)}
                  className="flex items-center justify-center font-extrabold uppercase transition-all active:scale-95 aspect-square"
                  style={{
                    backgroundColor: hasItems ? '#00cc13' : '#1a5c1a',
                    borderRadius: '12px',
                    padding: '4px',
                    color: hasItems ? '#fff' : '#88aa88',
                    boxShadow: hasItems ? '0 0 12px #00cc1380' : 'none',
                  }}
                >
                  <span style={{ fontSize: 'clamp(0.9rem, 3vw, 2.5rem)', lineHeight: 1 }}>{num}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export { OpenPage };
