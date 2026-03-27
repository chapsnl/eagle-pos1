import { Button } from '@/components/ui/button';

interface IntroPageProps {
  onEnter: () => void;
}

export const IntroPage = ({ onEnter }: IntroPageProps) => {
  return (
    <div className="min-h-screen bg-[hsl(220,10%,18%)] flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold tracking-tight text-foreground font-mono">
        Eagle POS System
      </h1>
      <img
        src="/placeholder.svg"
        alt="Eagle POS Logo"
        className="w-40 h-40 opacity-80"
      />
      <Button
        size="lg"
        className="text-lg px-12 py-6"
        onClick={onEnter}
      >
        Enter
      </Button>
    </div>
  );
};
