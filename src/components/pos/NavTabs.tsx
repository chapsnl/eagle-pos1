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
    <div className="bg-card border-b border-border flex items-center justify-between px-1">
      <div className="flex">
        {tabs.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`pos-btn flex items-center gap-1 px-3 py-2.5 text-[10px] border-b-2 transition-colors relative ${
              activeView === view
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {view === 'betaling' && itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pr-1">
        <span className="text-[9px] font-bold text-primary tracking-widest">EAGLE AMS</span>
        <StatusBar />
      </div>
    </div>
  );
};
