import { Wifi, WifiOff, BatteryFull, BatteryMedium, BatteryLow } from 'lucide-react';
import { useEffect, useState } from 'react';

export const StatusBar = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [battery, setBattery] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery API (if available)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        setBattery(Math.round(b.level * 100));
        b.addEventListener('levelchange', () => setBattery(Math.round(b.level * 100)));
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const BatteryIcon = battery !== null && battery < 20 ? BatteryLow : battery !== null && battery < 60 ? BatteryMedium : BatteryFull;

  return (
    <div className="flex items-center gap-3 text-muted-foreground text-xs">
      {online ? <Wifi className="w-4 h-4 text-pos-online" /> : <WifiOff className="w-4 h-4 text-pos-offline" />}
      <div className="flex items-center gap-1">
        <BatteryIcon className="w-4 h-4" />
        {battery !== null && <span>{battery}%</span>}
      </div>
    </div>
  );
};
