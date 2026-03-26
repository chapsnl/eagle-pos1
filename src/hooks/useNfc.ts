/**
 * Sunmi NFC helper – Keyboard Wedge method.
 * Uses a hidden input field (inputmode="none") that captures
 * the Sunmi scanner's keyboard-emulated NFC UID + Enter.
 */

export interface NfcScanResult {
  uid: string;
}

type NfcCallback = (uid: string) => void;

let _pendingCallback: NfcCallback | null = null;
let _cancelFn: (() => void) | null = null;

/**
 * Called by the hidden input's onChange/onKeyDown handler
 * when a complete UID is received (Enter pressed).
 */
export const submitNfcUid = (uid: string) => {
  const trimmed = uid.trim();
  if (!trimmed || !_pendingCallback) return;
  console.log('[NFC] UID received via wedge:', trimmed);
  const cb = _pendingCallback;
  _pendingCallback = null;
  cb(trimmed);
};

/**
 * Start listening for an NFC scan via the hidden input wedge.
 */
export const waitForNfcScan = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let rejectFn: (err: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

  const cancel = () => {
    _pendingCallback = null;
    clearTimeout(timer);
    rejectFn?.(new Error('NFC_CANCELLED'));
  };

  _cancelFn = cancel;

  const promise = new Promise<NfcScanResult>((resolve, reject) => {
    rejectFn = reject;

    timer = setTimeout(() => {
      _pendingCallback = null;
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    _pendingCallback = (uid: string) => {
      clearTimeout(timer);
      resolve({ uid });
    };

    console.log('[NFC] Wedge scan started, waiting for hidden input...');
  });

  return { promise, cancel };
};
