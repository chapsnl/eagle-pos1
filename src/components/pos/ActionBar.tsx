interface ActionBarProps {
  total: number;
  hasItems: boolean;
  onPin: () => void;
  onCash: () => void;
  onCorrect: () => void;
  onIncident: () => void;
}

export const ActionBar = ({ total, hasItems, onPin, onCash, onCorrect, onIncident }: ActionBarProps) => {
  return (
    <div className="bg-card border-t border-border p-3 flex items-center gap-2">
      <button
        onClick={onPin}
        disabled={!hasItems}
        className="pos-btn flex-1 bg-primary text-primary-foreground rounded-lg py-4 text-base disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
      >
        PIN
      </button>
      <button
        onClick={onCash}
        disabled={!hasItems}
        className="pos-btn flex-1 bg-pos-soft text-foreground rounded-lg py-4 text-base disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
      >
        CONTANT
      </button>
      <button
        onClick={onCorrect}
        className="pos-btn bg-secondary text-secondary-foreground rounded-lg py-4 px-4 text-xs hover:brightness-110"
      >
        CORRIGEER
      </button>
      <button
        onClick={onIncident}
        className="pos-btn bg-destructive text-destructive-foreground rounded-lg py-4 px-4 text-xs hover:brightness-110"
      >
        INCIDENT
      </button>
    </div>
  );
};
