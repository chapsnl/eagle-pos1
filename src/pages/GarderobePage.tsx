import { useState, useCallback, useEffect, useRef } from 'react';
import { FeedbackOverlay } from '@/components/pos/FeedbackOverlay';
import { NfcOverlay } from '@/components/pos/NfcOverlay';
import { FeedbackType } from '@/types/pos';
import { Send } from 'lucide-react';
import { useCreateSession, useUpdateSession } from '@/hooks/useSessions';
import { writeNfcTag, scanNfcTag } from '@/hooks/useNfc';
import { supabase } from '@/integrations/supabase/client';

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

export const GarderobePage = () => {
  const [coatNumber, setCoatNumber] = useState('');
  const [bagNumber, setBagNumber] = useState('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [activeField, setActiveField] = useState<'coat' | 'bag' | null>(null);
  const [nfcStatus, setNfcStatus] = useState<'scanning' | 'writing' | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();

  useEffect(() => {
    if (activeField === 'coat' && coatNumber.length >= 3) setActiveField(null);
    if (activeField === 'bag' && bagNumber.length >= 3) setActiveField(null);
  }, [coatNumber, bagNumber, activeField]);

  const handleSubmit = useCallback(async () => {
    if (!coatNumber && !bagNumber) return;
    const wardrobeNumber = `${coatNumber ? 'C' + coatNumber : ''}${bagNumber ? 'B' + bagNumber : ''}`;

    setNfcStatus('scanning');
    const { promise: scanPromise, cancel: cancelScan } = scanNfcTag(30000);
    cancelRef.current = cancelScan;

    let uid: string;
    let tagWardrobeNumber: string | null = null;

    try {
      const result = await scanPromise;
      uid = result.uid;

      if (result.message) {
        try {
          const parsed = JSON.parse(result.message);
          if (parsed?.wn && typeof parsed.wn === 'string') {
            tagWardrobeNumber = parsed.wn;
          }
        } catch {
          const raw = result.message.trim();
          if (/^C\d{1,3}(B\d{1,3})?$|^B\d{1,3}(C\d{1,3})?$/.test(raw)) {
            tagWardrobeNumber = raw;
          }
        }
      }
    } catch (err: any) {
      setNfcStatus(null);
      if (err.message !== 'NFC_CANCELLED') {
        setFeedback('error');
        setTimeout(() => setFeedback(null), 2000);
      }
      return;
    }

    // Block overwrite if tag itself already has a coat/bag number
    if (tagWardrobeNumber) {
      setNfcStatus(null);
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // Block if this wardrobe number is already assigned to any active session
    const { data: existingWnSession, error: wnError } = await supabase
      .from('sessions')
      .select('id')
      .eq('wardrobe_number', wardrobeNumber)
      .in('status', ['active', 'paid', 'incident'])
      .limit(1)
      .maybeSingle();

    if (wnError) {
      setNfcStatus(null);
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (existingWnSession) {
      setNfcStatus(null);
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // Block overwrite if DB has a non-archived session with wardrobe_number on this UID
    const { data: existingSession, error: existingSessionError } = await supabase
      .from('sessions')
      .select('wardrobe_number')
      .eq('nfc_uid', uid)
      .in('status', ['active', 'paid', 'incident'])
      .not('wardrobe_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      setNfcStatus(null);
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (existingSession?.wardrobe_number) {
      setNfcStatus(null);
      setFeedback('error');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // Write wn payload to NFC
    setNfcStatus('writing');
    const payload = JSON.stringify({ wn: wardrobeNumber });
    const { promise: writePromise, cancel: cancelWrite } = writeNfcTag(payload, 30000);
    cancelRef.current = cancelWrite;

    try {
      await writePromise;
      setNfcStatus(null);

      const session = await createSession.mutateAsync({ nfc_uid: uid });
      await updateSession.mutateAsync({
        id: session.id,
        wardrobe_number: wardrobeNumber,
      });

      setFeedback('success');
      setTimeout(() => {
        setFeedback(null);
        setCoatNumber('');
        setBagNumber('');
        setActiveField(null);
      }, 2000);
    } catch (err: any) {
      setNfcStatus(null);
      if (err.message !== 'NFC_CANCELLED') {
        setFeedback('error');
        setTimeout(() => setFeedback(null), 2000);
      }
    }
  }, [coatNumber, bagNumber, createSession, updateSession]);

  const handleCancelNfc = useCallback(() => {
    cancelRef.current?.();
    setNfcStatus(null);
  }, []);

  const handleNumKey = (key: string) => {
    if (!activeField) return;
    const setter = activeField === 'coat' ? setCoatNumber : setBagNumber;
    const value = activeField === 'coat' ? coatNumber : bagNumber;
    if (key === 'DEL') {
      setter('');
    } else if (value.length < 3) {
      setter(value + key);
    }
  };

  const showNumpad = activeField !== null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <FeedbackOverlay type={feedback} />
      <NfcOverlay status={nfcStatus} onCancel={handleCancelNfc} />

      <h2 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pt-3 pb-2" style={{ color: '#00cc13' }}>
        COAT CHECK
      </h2>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 min-h-0">
        <div className="w-full max-w-[280px]">
          <label className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pb-2 block" style={{ color: '#00cc13' }}>
            COAT
          </label>
          <div
            onClick={() => setActiveField('coat')}
            className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              fontSize: 'clamp(40px, 10vw, 80px)',
              padding: 'clamp(16px, 3vh, 32px) 16px',
              border: activeField === 'coat' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'coat' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {coatNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>
        <div className="w-full max-w-[280px]">
          <label className="text-2xl font-extrabold uppercase tracking-[0.2em] text-center pb-2 block" style={{ color: '#00cc13' }}>
            BAG
          </label>
          <div
            onClick={() => setActiveField('bag')}
            className="w-full font-extrabold text-center cursor-pointer flex items-center justify-center"
            style={{
              backgroundColor: '#d1d5db',
              color: '#111',
              fontSize: 'clamp(40px, 10vw, 80px)',
              padding: 'clamp(16px, 3vh, 32px) 16px',
              border: activeField === 'bag' ? '3px solid #00cc13' : '3px solid transparent',
              boxShadow: activeField === 'bag' ? '0 0 12px #00cc1380, 0 0 24px #00cc1330' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {bagNumber || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
        </div>

        {(coatNumber || bagNumber) && (
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Preview: </span>
            <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
              {coatNumber ? 'C' + coatNumber : ''}{bagNumber ? 'B' + bagNumber : ''}
            </span>
          </div>
        )}
      </div>

      {showNumpad && (
        <div className="px-4 pb-2">
          <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-0">
            {NUM_KEYS.map((key, i) => (
              <button
                key={i}
                onClick={() => key && handleNumKey(key)}
                disabled={!key}
                className="py-3 text-2xl font-extrabold uppercase disabled:invisible"
                style={{
                  backgroundColor: key === 'DEL' ? '#ef4444' : '#2a2a2a',
                  color: key === 'DEL' ? '#fff' : '#e5e5e5',
                  border: '1px solid #333',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
        <button
          onClick={handleSubmit}
          disabled={!coatNumber && !bagNumber}
          className="w-full py-3 text-lg font-extrabold uppercase disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{
            backgroundColor: '#00cc13',
            color: '#fff',
            boxShadow: '0 0 16px #00cc1380, 0 0 32px #00cc1330',
          }}
        >
          <Send className="w-6 h-6" />
          SEND
        </button>
      </div>
    </div>
  );
};
