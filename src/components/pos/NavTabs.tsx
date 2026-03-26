import { AppView } from '@/types/pos';
import { StatusBar } from './StatusBar';

interface NavTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  itemCount?: number;
}

const tabs: { view: AppView; label: string }[] = [
  { view: 'bar', label: 'BAR' },
  { view: 'garderobe', label: 'GARDEROBE' },
  { view: 'betaling', label: 'PAY' },
  { view: 'arm-nummer', label: 'NO-NFC' },
  { view: 'admin', label: 'ADMIN' },
];

export const NavTabs = ({ activeView, onViewChange, itemCount = 0 }: NavTabsProps) => {
  return (
    <div className="flex items-center w-full">
      {tabs.map(({ view, label }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className="flex-1 py-1.5 text-[clamp(9px,2.2vw,12px)] font-extrabold uppercase tracking-wide relative"
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
          {view === 'betaling' && itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      ))}
      <div className="flex items-center gap-2 px-2 shrink-0">
        <span className="text-[8px] font-bold tracking-widest" style={{ color: '#00cc13' }}>EAGLE</span>
        <StatusBar />
      </div>
    </div>
  );
};
