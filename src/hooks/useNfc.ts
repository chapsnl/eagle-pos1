/**
 * Native Web NFC helper using NDEFReader API.
 * Supports both reading UIDs and writing data to NTAG216 chips.
 */

export interface NfcScanResult {
  uid: string;
}

/**
 * Read an NFC tag's serial number (UID).
 * Returns a promise that resolves with the UID when a tag is tapped.
 */
export const scanNfcTag = (timeoutMs = 30000): { promise: Promise<NfcScanResult>; cancel: () => void } => {
  let abortController: AbortController | null = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;

  const cancel = () => {
    if (settled) return;
    settled = true;
    abortController?.abort();
    abortController = null;
    clearTimeout(timer);
  };

  const promise = new Promise<NfcScanResult>((resolve, reject) => {
    if (!('NDEFReader' in window)) {
      settled = true;
      reject(new Error('NFC_NOT_SUPPORTED'));
      return;
    }

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        abortController?.abort();
        reject(new Error('NFC_TIMEOUT'));
      }
    }, timeoutMs);

    const reader = new (window as any).NDEFReader();

    reader
      .scan({ signal: abortController!.signal })
      .then(() => {
        console.log('[NFC] Scan started, waiting for tag...');

        reader.onreading = (event: any) => {
          if (settled) return;
          const uid = event.serialNumber?.replace(/:/g, '').toUpperCase() || '';
          console.log('[NFC] Tag read, UID:', uid);
          settled = true;
          clearTimeout(timer);
          abortController?.abort();
          resolve({ uid });
        };

        reader.onreadingerror = () => {
          console.warn('[NFC] Read error');
        };
      })
      .catch((err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });

  return { promise, cancel };
};

/**
 * Write text data to an NFC tag (NTAG216).
 * The tag must be tapped during the write window.
 */
export const writeNfcTag = (data: string, timeoutMs = 30000): { promise: Promise<void>; cancel: () => void } => {
  let abortController: AbortController | null = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;

  const cancel = () => {
    if (settled) return;
    settled = true;
    abortController?.abort();
    abortController = null;
    clearTimeout(timer);
  };

  const promise = new Promise<void>((resolve, reject) => {
    if (!('NDEFReader' in window)) {
      settled = true;
      reject(new Error('NFC_NOT_SUPPORTED'));
      return;
    }

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        abortController?.abort();
        reject(new Error('NFC_TIMEOUT'));
      }
    }, timeoutMs);

    const writer = new (window as any).NDEFReader();

    console.log('[NFC] Write started, waiting for tag to write:', data);

    writer
      .write(
        { records: [{ recordType: 'text', data }] },
        { signal: abortController!.signal, overwrite: true }
      )
      .then(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.log('[NFC] Write successful');
          resolve();
        }
      })
      .catch((err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });

  return { promise, cancel };
};
