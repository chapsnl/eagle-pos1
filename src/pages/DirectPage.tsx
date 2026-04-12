import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { DbProduct, useProducts, getTextColor } from '@/hooks/useProducts';
import { NumPad } from '@/components/pos/NumPad';
import { useCreateSession, useAddDrinkLogs, useUpdateSession } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';
import { useQueryClient } from '@tanstack/react-query';

interface DirectOrderItem {
  product: DbProduct;
  quantity: number;
}

const gridLayout: { code: string; span: number; hideLabel?: boolean; label?: string }[][] = [
  [
    { code: '1', span: 1 }, { code: '6', span: 1 }, { code: 'SHO', span: 1 }, { code: 'BAIL', span: 1 },
    { code: 'JAME', span: 2 }, { code: 'ABSO', span: 2 }, { code: 'HEIN', span: 2 },
  ],
  [
    { code: '20', span: 1 }, { code: '18', span: 1 }, { code: 'TTOP', span: 1 }, { code: 'MALI', span: 1 },
    { code: 'JACD', span: 2 }, { code: 'BOMB', span: 2 }, { code: 'GROL', span: 2 },
  ],
  [
    { code: '7', span: 1 }, { code: '12.5', span: 1 }, { code: 'AMAR', span: 1 }, { code: 'TEQU', span: 1 },
    { code: 'JIMB', span: 2 }, { code: 'APPC', span: 2 }, { code: 'COAF', span: 2 },
  ],
  [
    { code: 'ENTR', span: 1, label: '8' }, { code: '10', span: 1 }, { code: 'TSHI', span: 1 }, { code: 'SAMB', span: 1 },
    { code: 'BSPI', span: 2 }, { code: 'WHIB', span: 2 }, { code: 'HE0%', span: 2 },
  ],
  [
    { code: 'ENTR', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'JAEG', span: 1 }, { code: 'LICO', span: 1 },
    { code: 'BACA', span: 2 }, { code: 'JENE', span: 2 }, { code: 'JUIC', span: 2 },
  ],
  [
    { code: 'ENTR', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'SEXT', span: 1 }, { code: 'STFF', span: 1 },
    { code: 'REDB', span: 2 }, { code: 'WINE', span: 2 }, { code: 'SOFT', span: 2 },
  ],
];

export const DirectPage = () => {
  const { data: products, isLoading: productsLoading } = useProducts();
  const [items, setItems] = useState<DirectOrderItem[]>([]);
  const [showNumberPopup, setShowNumberPopup] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [retourMode, setRetourMode] = useState(false);
  const [retourFlash, setRetourFlash] = useState<string | null>(null);

  const qc = useQueryClient();
  const createSession = useCreateSession();
  const addDrinkLogs = useAddDrinkLogs();
  const updateSession = useUpdateSession();
  const deviceId = useRef(getDeviceId()).current;

  const productMap = new Map((products ?? []).map((p) => [p.shorthand, p]));

  const addProduct = useCallback((product: DbProduct) => {
    if (retourMode) {
      const inItems = items.find((i) => i.product.id === product.id);
      if (!inItems || inItems.quantity <= 0) return;
      setRetourFlash(product.id);
      setTimeout(() => setRetourFlash(null), 600);
      setItems((prev) => prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity !== 0));
      setRetourMode(false);
      return;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [{ product, quantity: 1 }, ...prev];
    });
  }, [retourMode, items]);

  const handleNumberKey = useCallback((key: string) => {
    if (key === 'DEL') { setNumberInput(''); return; }
    if (key === 'BACK') { setNumberInput(prev => prev.slice(0, -1)); return; }
    if (numberInput.length < 3) setNumberInput(prev => prev + key);
  }, [numberInput]);

  const handleNumberButton = useCallback(() => {
    if (items.length === 0) {
      toast.error('Selecteer eerst producten');
      return;
    }
    setNumberInput('');
    setShowWarning(false);
    setShowNumberPopup(true);
  }, [items]);

  const handleConfirmNumber = useCallback(async () => {
    if (numberInput.length === 0) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const wardrobeNum = numberInput;

      // Check for existing active session
      const cachedSessions: any[] | undefined = qc.getQueryData(['sessions', 'active']);
      let session = cachedSessions?.find(s => s.wardrobe_number === wardrobeNum) ?? null;

      if (!session) {
        // Check closed sessions
        const { data: closedSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('wardrobe_number', wardrobeNum)
          .in('status', ['paid', 'archived'])
          .limit(1)
          .maybeSingle();
        if (closedSession) {
          toast.error(`Nummer ${wardrobeNum} is al afgerekend en gesloten.`);
          setIsSubmitting(false);
          return;
        }
      }

      if (session) {
        // Check lock
        const { data: fresh } = await supabase
          .from('sessions')
          .select('locked_by, locked_at')
          .eq('id', session.id)
          .single();
        const lockedBy = fresh?.locked_by;
        const lockedAt = fresh?.locked_at;
        if (lockedBy && lockedBy !== deviceId) {
          const lockAge = lockedAt ? Date.now() - new Date(lockedAt).getTime() : Infinity;
          if (lockAge < 60000) {
            toast.error('Dit nummer is in gebruik door een andere medewerker.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Create or get session
      if (!session) {
        session = await createSession.mutateAsync({
          wardrobe_number: wardrobeNum,
          is_event_numbered: true,
        });
      }

      // Lock, add drinks, update total
      await supabase.from('sessions').update({ locked_by: deviceId, locked_at: new Date().toISOString() } as any).eq('id', session.id);

      const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const logs = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          session_id: session.id,
          product_id: item.product.id,
          price_at_time: item.product.price,
        }))
      );

      await addDrinkLogs.mutateAsync(logs);
      const newTotal = Number(session.total_amount ?? 0) + total;
      await updateSession.mutateAsync({ id: session.id, total_amount: newTotal });
      await supabase.from('sessions').update({ locked_by: null, locked_at: null } as any).eq('id', session.id);

      toast.success(`${items.reduce((s, i) => s + i.quantity, 0)} item(s) geboekt op nummer ${wardrobeNum}`);

      // Reset
      setItems([]);
      setShowNumberPopup(false);
      setNumberInput('');
    } catch {
      toast.error('Opslaan mislukt — probeer opnieuw');
    } finally {
      setIsSubmitting(false);
    }
  }, [numberInput, items, qc, createSession, addDrinkLogs, updateSession, deviceId]);

  const handleNext = useCallback(() => {
    if (items.length > 0) {
      // Items present but no number assigned — force number popup
      setNumberInput('');
      setShowWarning(false);
      setShowNumberPopup(true);
      return;
    }
    setItems([]);
    setRetourMode(false);
  }, [items]);

  const handlePayButton = useCallback(() => {
    if (items.length === 0) {
      toast.error('Selecteer eerst producten');
      return;
    }
    setNumberInput('');
    setShowWarning(false);
    setShowNumberPopup(true);
  }, [items]);

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)'; },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; },
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; },
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full relative" style={{ ...(retourMode ? { border: '4px solid #ef4444', boxShadow: 'inset 0 0 30px rgba(239,68,68,0.15)' } : {}) }}>
      {/* Retour mode banner */}
      {retourMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: '#ef4444', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>
          ⚠ RETOUR MODUS ACTIEF ⚠
        </div>
      )}

      {/* Left column - Order summary */}
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden" style={{ width: '20%', backgroundColor: retourMode ? '#1a0a0a' : '#121212', borderRight: `1px solid ${retourMode ? '#ef4444' : '#333'}`, transition: 'background-color 0.3s ease' }}>
        <div className="text-center py-3 border-b" style={{ borderColor: '#333' }}>
          <span className="font-extrabold uppercase" style={{ color: '#00cc13', fontSize: 'clamp(14px, 2vw, 22px)', letterSpacing: '0.1em' }}>DIRECT</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.product.id} style={{ color: '#00cc13', fontSize: 'clamp(11px, 1.8vw, 25px)', padding: 'clamp(3px, 0.5vh, 8px) 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', fontWeight: 800 }}>
                {item.quantity} x {item.product.full_name}
              </div>
            ))
          ) : (
            <div className="text-center py-4" style={{ color: '#555', fontSize: 'clamp(10px, 1.2vw, 14px)' }}>Geen producten</div>
          )}
        </div>
      </div>

      {/* Right column - Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden gap-[1px]" style={{ width: '80%', backgroundColor: 'rgba(0,0,0,0.3)' }}>
        {productsLoading ? (
          gridLayout.map((row, ri) => (
            <div key={ri} className="flex-1 flex gap-[1px]" style={{ minHeight: 0 }}>
              {row.map((cell, ci) => (
                <div key={ci} className="animate-pulse" style={{ flex: cell.span, backgroundColor: '#2a2a2a' }} />
              ))}
            </div>
          ))
        ) : (
          gridLayout.map((row, ri) => (
            <div key={ri} className="flex-1 flex gap-[1px]" style={{ minHeight: 0 }}>
              {row.map((cell, ci) => {
                // Row 3 col 0: Entree button with label "8"
                if (ri === 3 && ci === 0) {
                  const entrProduct = productMap.get('ENTR');
                  const entBg = entrProduct?.category_color || '#e4e2e2';
                  const entTextColor = entrProduct ? getTextColor(entrProduct.category_color) : '#000';
                  return (
                    <button key={ci} onClick={() => { if (entrProduct) addProduct(entrProduct); }} style={{ flex: cell.span, backgroundColor: entBg, color: entTextColor }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                      <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>8</span>
                    </button>
                  );
                }
                // Row 4 col 0: PAY button (opens number popup for pay)
                if (ri === 4 && ci === 0) {
                  return (
                    <button key={ci} onClick={handlePayButton} style={{ flex: cell.span, backgroundColor: '#ef4444', color: '#fff' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                      <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>PAY</span>
                    </button>
                  );
                }
                // Row 4 col 1: RETOUR button
                if (ri === 4 && ci === 1) {
                  return (
                    <button key={ci} onClick={() => setRetourMode((m) => !m)} style={{ flex: cell.span, backgroundColor: retourMode ? '#ef4444' : '#7c3aed', color: '#fff', transition: 'background-color 0.2s ease' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                      <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>RETOUR</span>
                    </button>
                  );
                }
                // Row 5 col 0: NEXT button
                if (ri === 5 && ci === 0) {
                  return (
                    <button key={ci} onClick={handleNext} style={{ flex: cell.span, backgroundColor: '#1a3a6a', color: '#fff' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                      <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>NEXT</span>
                    </button>
                  );
                }
                // Row 5 col 1: NUMBER button (light green)
                if (ri === 5 && ci === 1) {
                  return (
                    <button key={ci} onClick={handleNumberButton} style={{ flex: cell.span, backgroundColor: '#00cc13', color: '#fff' }} className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                      <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>NUMBER</span>
                    </button>
                  );
                }
                // Regular product buttons
                const product = productMap.get(cell.code);
                if (!product) return <div key={ci} style={{ flex: cell.span }} />;
                const textColor = getTextColor(product.category_color);
                return (
                  <button key={ci} onClick={() => addProduct(product)} style={{ flex: cell.span, backgroundColor: product.category_color, color: textColor }} className="pos-btn flex items-center justify-center active:brightness-[0.6] p-1 min-w-0 transition-all duration-75" {...pointerHandlers}>
                    <span className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line" style={{ fontSize: cell.span === 2 ? 'clamp(0.96rem, 3.04vw, 2.48rem)' : 'clamp(0.48rem, 1.62vw, 1.24rem)' }}>
                      {cell.hideLabel ? '' : (cell.label || product.full_name)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Number entry popup overlay */}
      {showNumberPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="flex flex-col items-center w-full max-w-sm mx-auto px-6 gap-6">
            <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center" style={{ color: '#00cc13' }}>GAST NUMMER</h2>
            <div className="flex items-center justify-center w-full">
              <div className="w-full" style={{ maxWidth: '280px' }}>
                <div className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center" style={{ backgroundColor: '#d1d5db', color: '#111', fontSize: 'clamp(48px, 10vw, 80px)', padding: 'clamp(12px, 2vh, 24px) 16px', border: `3px solid ${showWarning ? '#ef4444' : '#00cc13'}`, boxShadow: showWarning ? '0 0 12px #ef444480, 0 0 24px #ef444430' : '0 0 12px #00cc1380, 0 0 24px #00cc1330', borderRadius: '12px' }}>
                  {numberInput || <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
                {showWarning && (
                  <p className="text-center font-bold mt-2" style={{ color: '#ef4444', fontSize: 'clamp(12px, 2vw, 16px)' }}>Voer een gastnummer in!</p>
                )}
              </div>
            </div>
            <NumPad onKey={handleNumberKey} disabled={isSubmitting} />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setShowNumberPopup(false); setShowWarning(false); }}
                className="flex-1 py-4 font-extrabold uppercase text-lg"
                style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: 6 }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmNumber}
                disabled={isSubmitting}
                className="flex-1 py-4 font-extrabold uppercase text-lg disabled:opacity-50"
                style={{ backgroundColor: '#00cc13', color: '#fff', borderRadius: 6 }}
              >
                {isSubmitting ? 'LADEN...' : 'BOEK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
