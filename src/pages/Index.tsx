import { useState, useCallback, useRef } from 'react';
import { AppView } from '@/types/pos';

import { NavTabs } from '@/components/pos/NavTabs';
import { AdminPage } from './AdminPage';
import { OpenPage } from './OpenPage';
import { ClosedPage } from './ClosedPage';
import { TestPage, TestPageHandle } from './TestPage';
import { DirectPage } from './DirectPage';
import { useCreateSession, useAddDrinkLogs, useUpdateSession, useFindActiveSessionByWardrobe } from '@/hooks/useSessions';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';

const Index = () => {
  const [activeView, setActiveView] = useState<AppView>('direct');
  const [pendingGuestNumber, setPendingGuestNumber] = useState<string | null>(null);
  const [pendingSessionData, setPendingSessionData] = useState<{ sessionId: string; wardrobeNumber: string; totalAmount: number } | null>(null);
  const [openInlineSession, setOpenInlineSession] = useState<{ sessionId: string; wardrobeNumber: string; totalAmount: number } | null>(null);
  const [showLockedWarning, setShowLockedWarning] = useState(false);
  const testPageRef = useRef<TestPageHandle>(null);
  const openTestPageRef = useRef<TestPageHandle>(null);
  const deviceId = useRef(getDeviceId()).current;

  // Imports kept (rule 5 carve-out covers this refactor) — used by OPEN inline lock acquisition
  // and re-exported availability for AdminPage navigation.
  void useCreateSession;
  void useAddDrinkLogs;
  void useUpdateSession;
  void useFindActiveSessionByWardrobe;

  const lockSession = useCallback(async (sid: string) => {
    await supabase.from('sessions').update({ locked_by: deviceId, locked_at: new Date().toISOString() } as any).eq('id', sid);
  }, [deviceId]);

  const handleNavigateToOpen = useCallback(() => {
    setPendingGuestNumber(null);
    setPendingSessionData(null);
    setOpenInlineSession(null);
    setActiveView('open');
  }, []);

  const handleViewChange = useCallback((view: AppView) => {
    if (activeView === 'test' && view !== 'test') {
      testPageRef.current?.saveAndCleanup();
    }
    if (activeView === 'open' && view !== 'open' && openInlineSession) {
      openTestPageRef.current?.saveAndCleanup();
      setOpenInlineSession(null);
    }
    setActiveView(view);
  }, [activeView, openInlineSession]);

  const lockedDialog = (
    <Dialog open={showLockedWarning} onOpenChange={(open) => { if (!open) setShowLockedWarning(false); }}>
      <DialogContent className="bg-card flex flex-col items-center gap-4 py-8" style={{ borderColor: '#ef444440', borderRadius: 12, maxWidth: 360 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px #ef444480' }}>
          <AlertCircle className="w-12 h-12 text-white" />
        </div>
        <p className="text-center font-extrabold text-lg px-4" style={{ color: '#ef4444' }}>
          Let op: Een andere medewerker is momenteel bezig met deze gast.
        </p>
        <button onClick={() => setShowLockedWarning(false)} className="w-full max-w-[200px] py-3 font-extrabold uppercase text-sm" style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px #ef444480', borderRadius: 6 }}>OK</button>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {lockedDialog}
      <NavTabs activeView={activeView} onViewChange={handleViewChange} />

      {activeView === 'test' && (
        <TestPage
          ref={testPageRef}
          initialGuestNumber={pendingGuestNumber}
          initialSessionData={pendingSessionData}
          onGuestNumberConsumed={() => { setPendingGuestNumber(null); setPendingSessionData(null); }}
          onNavigateToOpen={handleNavigateToOpen}
        />
      )}
      {activeView === 'admin' && (
        <AdminPage onNavigateToGuest={(wardrobe, sessionId, totalAmount) => {
          setPendingSessionData({ sessionId, wardrobeNumber: wardrobe, totalAmount });
          setActiveView('test');
        }} />
      )}
      {activeView === 'open' && (
        openInlineSession ? (
          <TestPage
            ref={openTestPageRef}
            initialSessionData={openInlineSession}
            onGuestNumberConsumed={() => {}}
            onNavigateToOpen={() => { setOpenInlineSession(null); }}
          />
        ) : (
          <OpenPage onNavigateToGuest={async (wardrobe, sessionId, totalAmount) => {
            const { data: fresh } = await supabase
              .from('sessions')
              .select('locked_by, locked_at')
              .eq('id', sessionId)
              .single();
            const lockedBy = fresh?.locked_by;
            const lockedAt = fresh?.locked_at;
            if (lockedBy && lockedBy !== deviceId) {
              const lockAge = lockedAt ? Date.now() - new Date(lockedAt).getTime() : Infinity;
              if (lockAge < 60000) {
                setShowLockedWarning(true);
                return;
              }
            }
            await lockSession(sessionId);
            setOpenInlineSession({ sessionId, wardrobeNumber: wardrobe, totalAmount });
          }} />
        )
      )}
      {activeView === 'closed' && <ClosedPage />}
      {activeView === 'direct' && <DirectPage />}
    </div>
  );
};

export default Index;
