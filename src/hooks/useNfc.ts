/**
 * Sunmi NFC helper – listens for keyboard-emulated NFC UIDs.
 * The Sunmi L2s Pro sends NFC tag UIDs as rapid keystrokes followed by Enter.
 * We capture these via a hidden input field or the global onRfTagDetected callback.
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
  if (_pendingCallback && uid) {
    const cb = _pendingCallback;
    _pendingCallback = null;
    cb(uid.trim());
  }
};

/**
 * Keyboard listener: captures rapid keystrokes ending with Enter.
 * Sunmi sends the UID as digits/hex chars very fast, then presses Enter.
 */
const handleKeyDown = (e: KeyboardEvent) => {
  if (!_pendingCallback) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (_keyBuffer.length >= 4) {
      const uid = _keyBuffer;
      _keyBuffer = '';
      if (_keyTimer) clearTimeout(_keyTimer);
      const cb = _pendingCallback;
      _pendingCallback = null;
      cb(uid);
    }
    _keyBuffer = '';
    return;
  }

  // Accept hex characters and digits
  if (/^[0-9a-fA-F]$/.test(e.key)) {
    _keyBuffer += e.key;
    // Reset buffer if no more keys arrive within 200ms (not a barcode/NFC scan)
    if (_keyTimer) clearTimeout(_keyTimer);
    _keyTimer = setTimeout(() => {
      _keyBuffer = '';
    }, 200);
  }
};

// Install global keyboard listener once
document.addEventListener('keydown', handleKeyDown);

/**
 * Start listening for an NFC scan. Resolves when a UID is received
 * via keyboard emulation or the global onRfTagDetected callback.
 * Rejects only on timeout or explicit cancel.
 */
export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let rejectFn: (err: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

  const cancel = () => {
    _pendingCallback = null;
    _keyBuffer = '';
    clearTimeout(timer);
    rejectFn?.(new Error('NFC_CANCELLED'));
  };

  const promise = new Promise<NfcScanResult>((resolve, reject) => {
    rejectFn = reject;

    timer = setTimeout(() => {
      _pendingCallback = null;
      _keyBuffer = '';
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    _pendingCallback = (uid: string) => {
      clearTimeout(timer);
      resolve({ uid });
    };
  });

  return { promise, cancel };
};
