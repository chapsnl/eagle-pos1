import { Button } from '@/components/ui/button';

interface IntroPageProps {
  onEnter: () => void;
}

export const IntroPage = ({ onEnter }: IntroPageProps) => {
  return (
    <div className="min-h-screen bg-[hsl(220,15%,8%)] flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold tracking-tight text-foreground font-mono">
        Eagle POS System
      </h1>
      <img
        src="/placeholder.svg"
        alt="Eagle POS Logo"
        className="w-40 h-40 opacity-80"
      />
      <button
        onClick={onEnter}
        className="text-lg font-bold px-12 py-4 rounded-md tracking-wide"
        style={{
          backgroundColor: '#00cc13',
          color: '#ffffff',
          boxShadow: '0 0 20px #00cc1380, 0 0 40px #00cc1340, inset 0 1px 0 #ffffff20',
        }}
      >
        Enter
      </button>
    </div>
  );
};
