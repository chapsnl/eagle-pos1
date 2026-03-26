/**
 * Sunmi NFC helper – supports multiple input methods:
 * 1. Fully Kiosk Broadcast Receiver (com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED)
 * 2. Keyboard emulation fallback (rapid keystrokes + Enter)
 * 3. Direct window.onRfTagDetected callback
 */

export interface NfcScanResult {
  uid: string;
}

type NfcCallback = (uid: string) => void;

let _pendingCallback: NfcCallback | null = null;
let _keyBuffer = '';
let _keyTimer: ReturnType<typeof setTimeout> | null = null;
let _fullyRegistered = false;

/* ── Fully Kiosk Broadcast Receiver ── */
function setupFullyKiosk() {
  const fully = (window as any).fully;
  if (!fully || _fullyRegistered) return;

  try {
    fully.registerBroadcastReceiver('com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED');
    console.log('[NFC] Fully Kiosk broadcast receiver registered');
    _fullyRegistered = true;
  } catch (e) {
    console.log('[NFC] Fully Kiosk not available, using keyboard fallback');
  }
}

// Fully Kiosk broadcast handler
(window as any).onBroadcastReceive = (action: string, extras: string) => {
  console.log('[NFC] Broadcast received:', action, extras);
  if (action === 'com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED' && _pendingCallback) {
    try {
      const parsed = typeof extras === 'string' ? JSON.parse(extras) : extras;
      const uid = (parsed.data || parsed.Data || '').toString().trim();
      if (uid) {
        console.log('[NFC] Broadcast UID:', uid);
        const cb = _pendingCallback;
        _pendingCallback = null;
        _keyBuffer = '';
        if (_keyTimer) clearTimeout(_keyTimer);
        cb(uid);
      }
    } catch (e) {
      console.log('[NFC] Error parsing broadcast extras:', e);
    }
  }
};

/* ── Direct callback (legacy / Fully Kiosk alternative) ── */
(window as any).onRfTagDetected = (uid: string) => {
  console.log('[NFC] onRfTagDetected called with:', uid);
  if (_pendingCallback && uid) {
    const cb = _pendingCallback;
    _pendingCallback = null;
    _keyBuffer = '';
    if (_keyTimer) clearTimeout(_keyTimer);
    cb(uid.trim());
  }
};

/* ── Keyboard emulation fallback ── */
const handleKeyDown = (e: KeyboardEvent) => {
  if (!_pendingCallback) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (_keyBuffer.length >= 2) {
      const uid = _keyBuffer;
      _keyBuffer = '';
      if (_keyTimer) clearTimeout(_keyTimer);
      const cb = _pendingCallback;
      _pendingCallback = null;
      console.log('[NFC] Keyboard UID captured:', uid);
      cb(uid);
    }
    _keyBuffer = '';
    return;
  }

  if (/^[0-9a-fA-F]$/.test(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    _keyBuffer += e.key;
    if (_keyTimer) clearTimeout(_keyTimer);
    _keyTimer = setTimeout(() => {
      _keyBuffer = '';
    }, 500);
  }
};

document.addEventListener('keydown', handleKeyDown, true);

/* ── Public API ── */
export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let rejectFn: (err: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

  _keyBuffer = '';
  if (_keyTimer) clearTimeout(_keyTimer);

  // Try to register Fully Kiosk broadcast on first scan
  setupFullyKiosk();

  const cancel = () => {
    _pendingCallback = null;
    _keyBuffer = '';
    clearTimeout(timer);
    if (_keyTimer) clearTimeout(_keyTimer);
    rejectFn?.(new Error('NFC_CANCELLED'));
  };

  const promise = new Promise<NfcScanResult>((resolve, reject) => {
    rejectFn = reject;

    timer = setTimeout(() => {
      console.log('[NFC] Scan timeout after', timeoutMs, 'ms');
      _pendingCallback = null;
      _keyBuffer = '';
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    _pendingCallback = (uid: string) => {
      console.log('[NFC] Callback fired with UID:', uid);
      clearTimeout(timer);
      resolve({ uid });
    };

    console.log('[NFC] Scan started, waiting for broadcast/keyboard/callback...');
  });

  return { promise, cancel };
};
