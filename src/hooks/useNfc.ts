/**
 * Sunmi NFC helper – Keyboard Wedge only.
 * No Web NFC / NDEFReader / broadcast logic.
 */

export interface NfcScanResult {
  uid: string;
}

type NfcCallback = (uid: string) => void;

let _pendingCallback: NfcCallback | null = null;
let _keyBuffer = '';
let _keyTimer: ReturnType<typeof setTimeout> | null = null;

const deliverUid = (uid: string) => {
  const cleaned = uid.trim();
  if (!cleaned || !_pendingCallback) return;

  const cb = _pendingCallback;
  _pendingCallback = null;
  _keyBuffer = '';
  if (_keyTimer) clearTimeout(_keyTimer);
  cb(cleaned);
};

/**
 * Called by hidden input when it receives a complete UID.
 */
export const submitNfcUid = (uid: string) => {
  console.log('[NFC] submitNfcUid:', uid);
  deliverUid(uid);
};

/**
 * Global keyboard fallback for Sunmi wedge (digits/chars + Enter).
 */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (!_pendingCallback) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (_keyBuffer.length >= 2) deliverUid(_keyBuffer);
    _keyBuffer = '';
    return;
  }

  // Accept any printable character (UID formats vary by scanner setup)
  if (e.key.length === 1) {
    e.preventDefault();
    e.stopPropagation();
    _keyBuffer += e.key;

    if (_keyTimer) clearTimeout(_keyTimer);
    _keyTimer = setTimeout(() => {
      // Fallback when scanner does not send Enter
      if (_keyBuffer.length >= 6 && _pendingCallback) {
        deliverUid(_keyBuffer);
      } else {
        _keyBuffer = '';
      }
    }, 180);
  }
};

window.addEventListener('keydown', handleGlobalKeyDown, true);

export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let rejectFn: (err: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

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
      _pendingCallback = null;
      _keyBuffer = '';
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    _pendingCallback = (uid: string) => {
      clearTimeout(timer);
      resolve({ uid });
    };

    console.log('[NFC] Waiting for keyboard wedge input...');
  });

  return { promise, cancel };
};
