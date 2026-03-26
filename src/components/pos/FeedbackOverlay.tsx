import { Check, X } from 'lucide-react';
import { FeedbackType } from '@/types/pos';

interface FeedbackOverlayProps {
  type: FeedbackType;
}

export const FeedbackOverlay = ({ type }: FeedbackOverlayProps) => {
  if (!type) return null;

  return (
    <div className="pos-feedback-overlay">
      <div
        className={`w-52 h-52 rounded-full flex items-center justify-center ${
          type === 'success' ? '' : 'bg-pos-error'
        }`}
        style={type === 'success' ? {
          backgroundColor: '#00cc13',
          boxShadow: '0 0 40px #00cc1380, 0 0 80px #00cc1340, 0 0 120px #00cc1320',
        } : undefined}
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
