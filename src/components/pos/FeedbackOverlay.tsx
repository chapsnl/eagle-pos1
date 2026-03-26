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
        className={`w-28 h-28 rounded-full flex items-center justify-center ${
          type === 'success' ? 'bg-pos-success' : 'bg-pos-error'
        } shadow-2xl`}
      >
        {type === 'success' ? (
          <Check className="w-14 h-14 text-background stroke-[3]" />
        ) : (
          <X className="w-14 h-14 text-background stroke-[3]" />
        )}
      </div>
    </div>
  );
};
