import { Beer, ShieldCheck, Shirt, Hash } from 'lucide-react';
import { AppView } from '@/types/pos';
import { StatusBar } from './StatusBar';

interface NavTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const tabs: { view: AppView; label: string; icon: typeof Beer }[] = [
  { view: 'bar', label: 'BAR', icon: Beer },
  { view: 'garderobe', label: 'GARDEROBE', icon: Shirt },
  { view: 'arm-nummer', label: 'ARM NR', icon: Hash },
  { view: 'admin', label: 'ADMIN', icon: ShieldCheck },
];

export const NavTabs = ({ activeView, onViewChange }: NavTabsProps) => {
  return (
    <div className="bg-card border-b border-border flex items-center justify-between px-2">
      <div className="flex">
        {tabs.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`pos-btn flex items-center gap-1.5 px-4 py-3 text-xs border-b-2 transition-colors ${
              activeView === view
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 pr-2">
        <span className="text-xs font-bold text-primary tracking-widest">EAGLE AMS</span>
        <StatusBar />
      </div>
    </div>
  );
};
