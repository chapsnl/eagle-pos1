import { Beer, ShieldCheck, Shirt, CreditCard, Hash } from 'lucide-react';
import { AppView } from '@/types/pos';
import { StatusBar } from './StatusBar';

interface NavTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  itemCount?: number;
}

const tabs: { view: AppView; label: string; icon: typeof Beer }[] = [
  { view: 'bar', label: 'DRANKEN', icon: Beer },
  { view: 'garderobe', label: 'GARDEROBE', icon: Shirt },
  { view: 'betaling', label: 'BETALING', icon: CreditCard },
  { view: 'arm-nummer', label: 'ARM NR', icon: Hash },
  { view: 'admin', label: 'ADMIN', icon: ShieldCheck },
];

export const NavTabs = ({ activeView, onViewChange, itemCount = 0 }: NavTabsProps) => {
  return (
    <div className="flex items-center px-1 py-1 gap-1">
      {tabs.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className="pos-btn flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide relative"
          style={activeView === view ? {
            backgroundColor: '#00cc13',
            color: '#ffffff',
            boxShadow: '0 0 12px #00cc1380, 0 0 24px #00cc1330',
          } : {
            backgroundColor: '#1a1a1a',
            color: '#888888',
          }}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
          {view === 'betaling' && itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-3 pr-1">
        <span className="text-[9px] font-bold text-primary tracking-widest">EAGLE AMS</span>
        <StatusBar />
      </div>
    </div>
  );
};
