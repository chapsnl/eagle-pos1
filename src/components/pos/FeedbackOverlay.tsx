import { Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { FeedbackType } from '@/types/pos';

interface FeedbackOverlayProps {
  type: FeedbackType;
}

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
};

export const FeedbackOverlay = ({ type }: FeedbackOverlayProps) => {
  useEffect(() => {
    if (type === 'success') {
      playNotificationSound();
    }
  }, [type]);

  if (!type) return null;

  return (
    <div className="pos-feedback-overlay">
      <div
        className="w-52 h-52 rounded-full flex items-center justify-center"
        style={type === 'success' ? {
          backgroundColor: '#00cc13',
          boxShadow: '0 0 40px #00cc1380, 0 0 80px #00cc1340, 0 0 120px #00cc1320',
        } : {
          backgroundColor: '#ef4444',
          boxShadow: '0 0 40px #ef444480, 0 0 80px #ef444440, 0 0 120px #ef444420',
        }}
      >
        {type === 'success' ? (
          <Check className="w-28 h-28 text-white stroke-[3]" />
        ) : (
          <X className="w-28 h-28 text-background stroke-[3]" />
        )}
      </div>
    </div>
  );
};
