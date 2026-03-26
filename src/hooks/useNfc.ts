/**
 * Sunmi NFC helper – Global keyboard wedge method.
 * Captures keyboard-emulated UID input at window level and
 * resolves when Enter is received.
 */

export interface NfcScanResult {
  uid: string;
}

type NfcCallback = (uid: string) => void;

let _pendingCallback: NfcCallback | null = null;
let _cancelFn: (() => void) | null = null;
let _cleanupListener: (() => void) | null = null;
let _buffer = '';

const cleanupListener = () => {
  if (_cleanupListener) {
    _cleanupListener();
    _cleanupListener = null;
  }
  _buffer = '';
};

const resolveUid = (uid: string) => {
  const trimmed = uid.trim();
  if (!trimmed || !_pendingCallback) return;
  console.log('[NFC] UID received via global keypress:', trimmed);
  const cb = _pendingCallback;
  _pendingCallback = null;
  cleanupListener();
  cb(trimmed);
};

const startGlobalKeypressListener = () => {
  const onKeypress = (event: KeyboardEvent) => {
    if (!_pendingCallback) return;

    if (event.key === 'Enter' || event.key === '\r') {
      event.preventDefault();
      const uid = _buffer;
      _buffer = '';
      if (uid.length >= 2) resolveUid(uid);
      return;
    }

    if (/^\d$/.test(event.key)) {
      _buffer += event.key;
    }
  };

  window.addEventListener('keypress', onKeypress, true);
  return () => window.removeEventListener('keypress', onKeypress, true);
};

/**
 * Backward-compatible submit entrypoint.
 */
export const submitNfcUid = (uid: string) => {
  resolveUid(uid);
};

/**
 * Start listening for an NFC scan via global keyboard wedge.
 */
export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  _cancelFn?.();

  let rejectFn: ((err: Error) => void) | null = null;
  let timer: ReturnType<typeof setTimeout>;

  const cancel = () => {
    _pendingCallback = null;
    cleanupListener();
    clearTimeout(timer);
    rejectFn?.(new Error('NFC_CANCELLED'));
    rejectFn = null;
  };

  _cancelFn = cancel;

  const promise = new Promise<NfcScanResult>((resolve, reject) => {
    rejectFn = reject;

    timer = setTimeout(() => {
      _pendingCallback = null;
      cleanupListener();
      reject(new Error('NFC_TIMEOUT'));
      rejectFn = null;
    }, timeoutMs);

    _pendingCallback = (uid: string) => {
      clearTimeout(timer);
      rejectFn = null;
      resolve({ uid });
    };

    cleanupListener();
    _cleanupListener = startGlobalKeypressListener();

    console.log('[NFC] Global keypress scan started, waiting for Enter-terminated UID...');
  });

  return { promise, cancel };
};
