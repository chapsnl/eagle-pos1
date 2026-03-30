import { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useActiveSessions, useUpdateSession } from '@/hooks/useSessions';
import { FeedbackType } from '@/types/pos';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export const AdminPage = () => {
  const [showClosed, setShowClosed] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeShiftLoading, setCloseShiftLoading] = useState(false);
  const [closeShiftResult, setCloseShiftResult] = useState<{ success: boolean; message: string } | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center mb-6" style={{ color: '#00cc13', textShadow: '0 0 20px #00cc1340' }}>
          ADMIN PANEL
        </h2>

        {/* Active sessions overview */}
        <ActiveSessionsSection />

        <AdminButton
          label="AFGESLOTEN KLANTEN"
          description="Bekijk betaalde sessies"
          variant="success"
          onClick={() => setShowClosed(true)}
        />

        <AdminButton
          label="CLOSE SHIFT (E-MAIL)"
          description="Dagsaldo Resetten"
          variant="success"
          onClick={() => setShowCloseShift(true)}
        />
      </div>

      {/* Closed sessions dialog */}
      <ClosedSessionsDialog open={showClosed} onOpenChange={setShowClosed} />

      {/* Close Shift confirmation dialog */}
      <Dialog open={showCloseShift} onOpenChange={(v) => { if (!closeShiftLoading) { setShowCloseShift(v); setCloseShiftResult(null); } }}>
        <DialogContent className="bg-card rounded-[12px]" style={{ borderColor: '#00cc1340' }}>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase text-lg" style={{ color: '#00cc13' }}>
              {closeShiftResult ? (closeShiftResult.success ? 'SHIFT AFGESLOTEN' : 'FOUT') : 'CLOSE SHIFT'}
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {closeShiftResult
                ? (
                  <span className="text-base block py-2" style={{ color: '#00cc13' }}>
                    {closeShiftResult.message}
                  </span>
                )
                : (
                  <span className="text-base block py-2" style={{ color: '#00cc13' }}>
                    ⚠️ Weet je het zeker? Alle bestellingen gaan verloren!
                  </span>
                )
              }
            </DialogDescription>
          </DialogHeader>
          {!closeShiftResult && (
            <DialogFooter className="flex gap-3 sm:gap-3">
              <button
                onClick={() => { setShowCloseShift(false); setCloseShiftResult(null); }}
                className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px]"
                style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
                disabled={closeShiftLoading}
              >
                Nee
              </button>
              <button
                onClick={async () => {
                  setCloseShiftLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('close-shift');
                    if (error) throw error;
                    setCloseShiftResult({
                      success: true,
                      message: 'Rapport verstuurd!',
                    });
                  } catch (err: any) {
                    setCloseShiftResult({
                      success: false,
                      message: `Er ging iets mis: ${err.message}`,
                    });
                  } finally {
                    setCloseShiftLoading(false);
                  }
                }}
                className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px]"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
                disabled={closeShiftLoading}
              >
                {closeShiftLoading ? 'BEZIG...' : 'JA, SLUIT SHIFT'}
              </button>
            </DialogFooter>
          )}
          {closeShiftResult && (
            <DialogFooter>
              <button
                onClick={() => { setShowCloseShift(false); setCloseShiftResult(null); }}
                className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
                style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
              >
                OK
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ActiveSessionsSection = () => {
  const { data: sessions, isLoading } = useActiveSessions();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Users className="w-5 h-5" style={{ color: '#00cc13' }} />
        <div className="flex-1">
          <h3 className="text-sm font-extrabold uppercase">OPENSTAANDE BEZOEKERS</h3>
          <p className="text-xs text-muted-foreground">Actieve sessies</p>
        </div>
        <span className="text-lg font-extrabold" style={{ color: '#00cc13' }}>{sessions?.length ?? 0}</span>
      </div>

      {isLoading && (
        <div className="p-4 text-xs text-muted-foreground">Laden...</div>
      )}

      {sessions && sessions.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground">Geen actieve sessies</div>
      )}

      {sessions && [...sessions].sort((a, b) => {
        const numA = parseInt((a.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
        const numB = parseInt((b.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
        return numA - numB;
      }).map((session) => {
        const isExpanded = expandedId === session.id;
        const label = session.wardrobe_number || 'Anoniem';
        const drinkLogs = (session as any).drink_logs ?? [];

        return (
          <div key={session.id} className="border-t border-border">
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                  €{Number(session.total_amount).toFixed(2)}
                </span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3">
                <div className="text-xs text-muted-foreground mb-2">
                  Start: {new Date(session.created_at).toLocaleTimeString('nl-NL')}
                </div>
                {drinkLogs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Geen drankjes</div>
                ) : (
                  <div className="space-y-1">
                    {drinkLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase">
                          {log.products?.full_name ?? log.product_id}
                        </span>
                        <span style={{ color: '#00cc13' }}>€{Number(log.price_at_time).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ClosedSessionsDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const updateSession = useUpdateSession();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('sessions')
      .select('*, drink_logs(*, products(*))')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => {
          const numA = parseInt((a.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
          const numB = parseInt((b.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
          return numA - numB;
        });
        setSessions(sorted);
        setLoading(false);
      });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-h-[80vh] overflow-y-auto rounded-[12px]" style={{ borderColor: '#00cc1340' }}>
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase" style={{ color: '#00cc13' }}>
            Afgesloten Klanten
          </DialogTitle>
          <DialogDescription className="text-sm">
            Betaalde sessies – numeriek gesorteerd
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4">Laden...</div>
        ) : sessions.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">Geen afgesloten sessies</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const label = s.wardrobe_number || 'Anoniem';
              const drinks = s.drink_logs || [];
              const drinkMap: Record<string, { qty: number; fullName: string; unitPrice: number }> = {};
              drinks.forEach((d: any) => {
                const name = d.products?.shorthand || '?';
                const fullName = d.products?.full_name || name;
                if (!drinkMap[name]) drinkMap[name] = { qty: 0, fullName, unitPrice: Number(d.price_at_time) };
                drinkMap[name].qty++;
              });
              return (
                <div key={s.id} className="bg-secondary px-3 py-2 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                      €{Number(s.total_amount).toFixed(2)}
                    </span>
                  </div>
                  {Object.entries(drinkMap).length > 0 && (
                    <div className="space-y-0.5">
                      {Object.entries(drinkMap).map(([key, { qty, fullName, unitPrice }]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{qty} x {fullName}</span>
                          <span className="text-muted-foreground">€{(qty * unitPrice).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const AdminButton = ({ label, description, variant, onClick }: {
  label: string; description: string; variant?: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-lg p-4 flex items-center gap-4 transition-all active:scale-[0.98] font-extrabold uppercase"
    style={{
      backgroundColor: variant === 'destructive' ? '#ef4444' : '#00cc13',
      color: '#fff',
      boxShadow: variant === 'destructive' ? '0 0 12px #ef444480' : '0 0 12px #00cc1380',
    }}
  >
    <div>
      <h3 className="text-sm font-extrabold uppercase">{label}</h3>
      <p className="text-xs opacity-80 font-normal normal-case">{description}</p>
    </div>
  </button>
);
