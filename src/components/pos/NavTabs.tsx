import { AppView } from '@/types/pos';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

interface NavTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  itemCount?: number;
}

const tabs: { view: AppView; label: string }[] = [
  { view: 'test', label: 'NR' },
  { view: 'direct', label: 'DIRECT' },
  { view: 'open', label: 'OPEN' },
  { view: 'closed', label: 'CLOSED' },
  { view: 'admin', label: 'ADMIN' },
];

export const NavTabs = ({ activeView, onViewChange, itemCount = 0 }: NavTabsProps) => {
  const { pending, online } = useOfflineQueue();

  return (
    <div className="flex items-center w-full relative">
      {tabs.map(({ view, label }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className={`flex-1 py-3.5 text-[clamp(12px,2.5vw,16px)] font-extrabold uppercase tracking-wide relative justify-center items-center text-center w-full${view === 'bar' ? ' flex md:hidden xl:flex' : ''}`}
          style={activeView === view ? {
            backgroundColor: '#00cc13',
            color: '#ffffff',
            boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330',
          } : {
            backgroundColor: '#1a1a1a',
            color: '#888888',
          }}
        >
          {label}
        </button>
      ))}
      {!online && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 4,
            animation: 'pulse 2s ease-in-out infinite',
            zIndex: 10,
          }}
        >
          OFFLINE{pending > 0 ? ` (${pending})` : ''}
        </div>
      )}
    </div>
  );
};
