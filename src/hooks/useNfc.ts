/**
 * Sunmi NFC helper – listens for keyboard-emulated NFC UIDs.
 * The Sunmi L2s Pro sends NFC tag UIDs as rapid keystrokes followed by Enter.
 * We capture these via a global keydown listener or the global onRfTagDetected callback.
 */

export interface NfcScanResult {
  uid: string;
}

type NfcCallback = (uid: string) => void;

let _pendingCallback: NfcCallback | null = null;
let _keyBuffer = '';
let _keyTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Global handler that Sunmi / Fully Kiosk can call directly.
 */
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

/**
 * Keyboard listener: captures rapid keystrokes ending with Enter.
 * Sunmi sends the UID as digits/hex chars very fast, then presses Enter.
 */
const handleKeyDown = (e: KeyboardEvent) => {
  // Always buffer hex chars when scanning is active
  if (!_pendingCallback) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    console.log('[NFC] Enter detected, buffer:', _keyBuffer, 'length:', _keyBuffer.length);
    if (_keyBuffer.length >= 2) {
      const uid = _keyBuffer;
      _keyBuffer = '';
      if (_keyTimer) clearTimeout(_keyTimer);
      const cb = _pendingCallback;
      _pendingCallback = null;
      console.log('[NFC] UID captured:', uid);
      cb(uid);
    }
    _keyBuffer = '';
    return;
  }

  // Accept hex characters, digits, and common NFC chars
  if (/^[0-9a-fA-F]$/.test(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    _keyBuffer += e.key;
    console.log('[NFC] Key buffered:', e.key, 'buffer now:', _keyBuffer);
    // Reset buffer if no more keys arrive within 500ms (generous for Sunmi)
    if (_keyTimer) clearTimeout(_keyTimer);
    _keyTimer = setTimeout(() => {
      console.log('[NFC] Buffer timeout, clearing:', _keyBuffer);
      _keyBuffer = '';
    }, 500);
  }
};

// Install global keyboard listener once, use capture phase to get events first
document.addEventListener('keydown', handleKeyDown, true);

/**
 * Start listening for an NFC scan. Resolves when a UID is received
 * via keyboard emulation or the global onRfTagDetected callback.
 */
export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let rejectFn: (err: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

  // Clear any previous state
  _keyBuffer = '';
  if (_keyTimer) clearTimeout(_keyTimer);

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

    console.log('[NFC] Scan started, waiting for input...');
  });

  return { promise, cancel };
};
