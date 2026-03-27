import { AppView } from '@/types/pos';

interface NavTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  itemCount?: number;
}

const tabs: { view: AppView; label: string }[] = [
  { view: 'bar', label: 'BAR' },
  { view: 'garderobe', label: 'COAT CHECK' },
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
          className="flex-1 py-3.5 text-[clamp(12px,2.5vw,16px)] font-extrabold uppercase tracking-wide relative"
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
    </div>
  );
};
