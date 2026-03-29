import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Square, Nfc, Users } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useActiveSessions, useIncidentSessions, useUpdateSession } from '@/hooks/useSessions';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { FeedbackType } from '@/types/pos';
import { supabase } from '@/integrations/supabase/client';
import { scanNfcTag, eraseNfcTag } from '@/hooks/useNfc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export const AdminPage = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeShiftLoading, setCloseShiftLoading] = useState(false);
  const [closeShiftResult, setCloseShiftResult] = useState<{ success: boolean; message: string } | null>(null);
  const [nfcStatus, setNfcStatus] = useState<'scanning' | 'writing' | null>(null);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [erasedCount, setErasedCount] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const batchModeRef = useRef(false);
  const [nfcReadMode, setNfcReadMode] = useState(false);
  const [nfcReadData, setNfcReadData] = useState<
    { uid: string; items: { shorthand: string; qty: number }[]; total: number; wn?: string; status?: string } | { raw: string[]; uid?: string } | null
  >(null);
  const nfcReadCancelRef = useRef<(() => void) | null>(null);
  const { data: productsData } = useProducts();

  // Keep ref in sync
  useEffect(() => {
    batchModeRef.current = batchMode;
  }, [batchMode]);

  const eraseNextTag = useCallback(async () => {
    if (!batchModeRef.current) return;

    setNfcStatus('scanning');

    try {
      const { promise, cancel } = eraseNfcTag(120000);
      cancelRef.current = cancel;

      const { uid, wn } = await promise;

      if (!batchModeRef.current) return;

      // Archive session in DB if exists
      try {
        await supabase.functions.invoke('batch-erase', {
          body: { nfc_uid: uid, wardrobe_number: wn || undefined },
        });
      } catch {
        // OK if no session found
      }

      setNfcStatus(null);
      setErasedCount((c) => c + 1);
      setFeedback('success');

      // After 2s show success, loop to next
      setTimeout(() => {
        setFeedback(null);
        if (batchModeRef.current) {
          eraseNextTag();
        }
      }, 2000);
    } catch (err: any) {
      if (err.message === 'CANCELLED' || err.message === 'NFC_CANCELLED') return;
      setNfcStatus(null);
      // On error, retry after a short delay
      if (batchModeRef.current) {
        setTimeout(() => eraseNextTag(), 500);
      }
    }
  }, []);

  const startBatchErase = useCallback(() => {
    setShowConfirm(false);
    setBatchMode(true);
    setErasedCount(0);
    // Small delay to let state settle
    setTimeout(() => eraseNextTag(), 100);
  }, [eraseNextTag]);

  const stopBatchErase = useCallback(() => {
    setBatchMode(false);
    batchModeRef.current = false;
    cancelRef.current?.();
    setNfcStatus(null);
    setFeedback(null);
  }, []);

  const startNfcRead = useCallback(async () => {
    setNfcReadMode(true);
    setNfcReadData(null);
    try {
      const { promise, cancel } = scanNfcTag(120000);
      nfcReadCancelRef.current = cancel;
      const result = await promise;

      const uid = result.uid || 'Geen UID';

      // Extract wardrobe number from NFC tag data first
      let tagWn: string | undefined;
      if (result.message) {
        try {
          const json = JSON.parse(result.message);
          if (json.wn) tagWn = json.wn;
        } catch { /* ignore */ }
      }

      // DB lookup first (source of truth) - try nfc_uid first, then wardrobe_number
      try {
        let session: any = null;

        // Try by NFC UID
        const { data: s1 } = await supabase
          .from('sessions')
          .select('id, total_amount, wardrobe_number, status')
          .eq('nfc_uid', uid)
          .in('status', ['active', 'paid'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        session = s1;

        // If not found by NFC UID, try by wardrobe number from tag
        if (!session && tagWn) {
          const wnNum = tagWn.replace(/[CB]/g, '');
          const { data: s2 } = await supabase
            .from('sessions')
            .select('id, total_amount, wardrobe_number, status')
            .in('status', ['active', 'paid'])
            .or(`wardrobe_number.like.%C${wnNum}%,wardrobe_number.like.%B${wnNum}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          session = s2;
        }

        if (session) {
          const { data: logs } = await supabase
            .from('drink_logs')
            .select('product_id, products(shorthand)')
            .eq('session_id', session.id);

          if (logs && logs.length > 0) {
            const agg: Record<string, { qty: number; shorthand: string }> = {};
            for (const log of logs) {
              const sh = (log as any).products?.shorthand || log.product_id;
              if (!agg[sh]) agg[sh] = { qty: 0, shorthand: sh };
              agg[sh].qty++;
            }
            setNfcReadData({
              uid,
              items: Object.values(agg),
              total: Number(session.total_amount),
              wn: session.wardrobe_number || tagWn || undefined,
              status: session.status,
            });
            return;
          }
        }
      } catch {
        // DB lookup failed, fall back to NFC data
      }

      // Fall back to NFC data
      if (result.message) {
        try {
          const json = JSON.parse(result.message);
          if (json.items && typeof json.items === 'string') {
            const items = json.items.split(',').map((entry: string) => {
              const match = entry.match(/^(\d+)x(.+)$/);
              return match ? { qty: parseInt(match[1]), shorthand: match[2] } : { qty: 1, shorthand: entry };
            });
            setNfcReadData({ uid, items, total: json.total ?? 0, wn: json.wn });
            return;
          }
        } catch { /* not JSON */ }
      }

      setNfcReadData({ raw: [`UID: ${uid}`, 'Geen besteldata gevonden'], uid });
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.message !== 'NFC_CANCELLED') {
        setNfcReadData({ raw: ['Fout bij lezen: ' + err.message] });
      }
    }
  }, []);

  const stopNfcRead = useCallback(() => {
    nfcReadCancelRef.current?.();
    setNfcReadMode(false);
    setNfcReadData(null);
  }, []);

  if (nfcReadMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full relative">
        <div className="text-center space-y-6">
          <Nfc className="w-20 h-20 mx-auto" style={{ color: '#00cc13', filter: 'drop-shadow(0 0 12px #00cc1380)' }} />
          <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
            NFC Uitlezen
          </h2>
          {!nfcReadData ? (
            <p className="text-muted-foreground text-sm animate-pulse">Scan een bandje om de data te lezen...</p>
          ) : 'raw' in nfcReadData ? (
            <div className="bg-card border rounded-lg p-4 text-left space-y-2 max-w-xs mx-auto break-words" style={{ borderColor: '#00cc1340' }}>
              {nfcReadData.raw.map((line, i) => (
                <p key={i} className="text-sm font-mono break-all" style={{ color: i === 0 ? '#00cc13' : undefined }}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-5 text-left max-w-sm mx-auto" style={{ borderColor: '#00cc1340' }}>
              <p className="text-xs font-mono mb-3 break-all" style={{ color: '#00cc13' }}>UID: {nfcReadData.uid}</p>
              <div className="space-y-2">
                {nfcReadData.items.map((item, i) => {
                  const product = productsData?.find(p => p.shorthand === item.shorthand);
                  return (
                    <div key={i} className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">{product?.full_name || item.shorthand}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{item.qty}x</span>
                        <span style={{ color: '#00cc13' }}>€{((product?.price ?? 0) * item.qty).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                <span className="font-extrabold uppercase" style={{ fontSize: '1rem' }}>Totaal</span>
                <span className="font-extrabold text-xl" style={{ color: '#00cc13' }}>€{Number(nfcReadData.total).toFixed(2)}</span>
              </div>
              {'status' in nfcReadData && nfcReadData.status && (
                <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                  <span className="font-extrabold uppercase" style={{ fontSize: '1rem' }}>Status</span>
                  <span
                    className="font-extrabold uppercase px-3 py-1 rounded-full text-sm"
                    style={nfcReadData.status === 'paid'
                      ? { backgroundColor: '#00cc13', color: '#fff' }
                      : { backgroundColor: '#f59e0b', color: '#fff' }
                    }
                  >
                    {nfcReadData.status === 'paid' ? 'BETAALD' : nfcReadData.status.toUpperCase()}
                  </span>
                </div>
              )}
              {nfcReadData.wn && (
                <div className="border-t border-border mt-3 pt-3 space-y-1">
                  {nfcReadData.wn.match(/C(\d+)/)?.[1] && (
                    <div className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">Coat Number</span>
                      <span style={{ color: '#00cc13' }}>{nfcReadData.wn.match(/C(\d+)/)![1]}</span>
                    </div>
                  )}
                  {nfcReadData.wn.match(/B(\d+)/)?.[1] && (
                    <div className="flex justify-between items-center" style={{ fontSize: '1rem' }}>
                      <span className="font-bold">Bag Number</span>
                      <span style={{ color: '#00cc13' }}>{nfcReadData.wn.match(/B(\d+)/)![1]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className={`flex gap-3 justify-center ${nfcReadData ? '' : 'hidden'}`}>
            <button
              onClick={() => { setNfcReadData(null); startNfcRead(); }}
              className="px-6 py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380' }}
            >
              Volgende Scan
            </button>
            <button
              onClick={async () => {
                try {
                  const uidToArchive = nfcReadData?.uid;
                  const wnToArchive = nfcReadData && 'wn' in nfcReadData ? nfcReadData.wn : undefined;

                  // Use the eraseNfcTag abstraction (works for both Capacitor and Web NFC)
                  const { promise } = eraseNfcTag(15000);
                  await promise;

                  // Always call batch-erase with both identifiers
                  await supabase.functions.invoke('batch-erase', {
                    body: { nfc_uid: uidToArchive || undefined, wardrobe_number: wnToArchive || undefined },
                  });

                  setNfcReadData({
                    raw: uidToArchive
                      ? [`UID: ${uidToArchive}`, 'Tag gewist + sessie gearchiveerd']
                      : ['Tag gewist!'],
                    uid: uidToArchive,
                  });
                } catch (err: any) {
                  setNfcReadData({ raw: ['Wissen mislukt: ' + err.message], uid: nfcReadData?.uid });
                }
              }}
              className="px-6 py-3 font-extrabold uppercase text-sm"
              style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 16px #ef444480' }}
            >
              NFC Wissen
            </button>
          </div>
          <button
            onClick={stopNfcRead}
            className="mt-4 px-8 py-4 text-lg font-extrabold uppercase flex items-center justify-center gap-3 mx-auto"
            style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330' }}
          >
            <Square className="w-6 h-6" />
            STOP UITLEZEN
          </button>
        </div>
      </div>
    );
  }

  if (batchMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full relative">
        <FeedbackOverlay type={feedback} />
        <NfcOverlay status={nfcStatus} onCancel={() => {}} />

        <div className="text-center space-y-6">
          <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em]" style={{ color: '#00cc13' }}>
            Batch-Erase Actief
          </h2>
          <p className="text-muted-foreground text-sm">
            Scan een bandje om te wissen. De scanner blijft automatisch draaien.
          </p>
          <div className="text-5xl font-extrabold" style={{ color: '#00cc13' }}>{erasedCount}</div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">bandjes gewist</p>

          <button
            onClick={stopBatchErase}
            className="mt-8 px-8 py-4 text-lg font-extrabold uppercase flex items-center justify-center gap-3 mx-auto"
            style={{
              backgroundColor: '#00cc13',
              color: '#fff',
              boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
            }}
          >
            <Square className="w-6 h-6" />
            STOP BATCH-ERASE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center mb-6" style={{ color: '#00cc13', textShadow: '0 0 20px #00cc1340' }}>
          ADMIN PANEL
        </h2>

        {/* Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-card rounded-[12px]" style={{ borderColor: '#00cc1340' }}>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase" style={{ color: '#00cc13' }}>
              Batch-Erase Starten
              </DialogTitle>
              <DialogDescription className="text-sm">
                Weet je zeker dat je bandjes wilt wissen? Alle data gaat verloren.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 sm:gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 font-extrabold uppercase text-sm bg-secondary text-secondary-foreground rounded-[6px]"
              >
                Annuleren
              </button>
              <button
                onClick={startBatchErase}
                className="flex-1 py-3 font-extrabold uppercase text-sm rounded-[6px]"
                style={{ backgroundColor: '#00cc13', color: '#fff' }}
              >
                Ja, Start Wissen
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

      {sessions && sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const label = session.wardrobe_number || (session.nfc_uid ? `UID: ${session.nfc_uid.slice(0, 8)}…` : 'Anoniem');
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
  const [reopenId, setReopenId] = useState<string | null>(null);
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
        // Sort numerically ascending by wardrobe number
        const sorted = (data || []).sort((a, b) => {
          const numA = parseInt((a.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
          const numB = parseInt((b.wardrobe_number || '').replace(/\D/g, '')) || Infinity;
          return numA - numB;
        });
        setSessions(sorted);
        setLoading(false);
      });
  }, [open]);

  const handleReopenKeep = async (id: string) => {
    try {
      await updateSession.mutateAsync({ id, status: 'active' });
      await supabase.from('sessions').update({ actual_paid_amount: null }).eq('id', id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setReopenId(null);
    } catch { /* error */ }
  };

  const handleReopenZero = async (id: string) => {
    try {
      await updateSession.mutateAsync({ id, status: 'active', total_amount: 0 });
      await supabase.from('sessions').update({ actual_paid_amount: null }).eq('id', id);
      // Delete all drink_logs for this session to reset
      await supabase.from('drink_logs').delete().eq('session_id', id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setReopenId(null);
    } catch { /* error */ }
  };

  return (
    <>
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
                const label = s.wardrobe_number || (s.nfc_uid ? `UID: ${s.nfc_uid.slice(0, 8)}…` : 'Anoniem');
                const drinks = s.drink_logs || [];
                const drinkMap: Record<string, number> = {};
                drinks.forEach((d: any) => {
                  const name = d.products?.shorthand || '?';
                  drinkMap[name] = (drinkMap[name] || 0) + 1;
                });
                const drinkSummary = Object.entries(drinkMap).map(([name, qty]) => `${qty}x ${name}`).join(', ');
                return (
                  <div key={s.id} className="bg-secondary px-3 py-2 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold">{label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          €{Number(s.total_amount).toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => setReopenId(s.id)}
                        className="px-4 py-2 text-xs font-extrabold uppercase rounded-[6px]"
                        style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
                      >
                        HEROPEN
                      </button>
                    </div>
                    {drinkSummary && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {drinkSummary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reopen confirmation with two options */}
      <Dialog open={!!reopenId} onOpenChange={() => setReopenId(null)}>
        <DialogContent className="bg-card rounded-[12px]" style={{ borderColor: '#00cc1340' }}>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase" style={{ color: '#00cc13' }}>
              Hoe wil je heropenen?
            </DialogTitle>
            <DialogDescription className="text-sm">
              Kies of je de bestelling wilt behouden of op €0 wilt starten.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={() => reopenId && handleReopenKeep(reopenId)}
              className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
              style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 12px #00cc1380' }}
            >
              Behoud Bestelling
            </button>
            <button
              onClick={() => reopenId && handleReopenZero(reopenId)}
              className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
              style={{ backgroundColor: '#f59e0b', color: '#fff', boxShadow: '0 0 12px #f59e0b80' }}
            >
              Open en bedrag op 0 zetten
            </button>
            <button
              onClick={() => setReopenId(null)}
              className="w-full py-3 font-extrabold uppercase text-sm rounded-[6px]"
              style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480' }}
            >
              Annuleren
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminCard = ({ title, description, value }: { title: string; description: string; value: string }) => (
  <div className="rounded-lg p-4 flex items-center gap-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #00cc1340' }}>
    <div className="flex-1">
      <h3 className="text-sm font-extrabold uppercase" style={{ color: '#00cc13' }}>{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <span className="text-2xl font-extrabold" style={{ color: '#00cc13' }}>{value}</span>
  </div>
);

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
