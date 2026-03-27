/**
 * Native Web NFC helper using NDEFReader API.
 * Supports both reading UIDs and writing data to NTAG216 chips.
 */

export interface NfcScanResult {
  uid: string;
  message?: string;
}

const softResetNfcContext = () => {
  if (!('NDEFReader' in window)) return;
  try {
    const resetReader = new (window as any).NDEFReader();
    const resetController = new AbortController();
    const scanPromise = resetReader.scan({ signal: resetController.signal });
    resetController.abort();
    void scanPromise.catch(() => undefined);
  } catch {
    // Ignore reset errors; next operation re-initializes the reader/writer anyway
  }
};

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
          let message: string | undefined;
          if (event.message?.records) {
            for (const rec of event.message.records) {
              try {
                if (rec.recordType === 'text' || rec.recordType === 'mime') {
                  const decoder = new TextDecoder(rec.encoding || 'utf-8');
                  message = decoder.decode(rec.data);
                  break;
                }
              } catch { /* ignore */ }
            }
          }
          console.log('[NFC] Tag read, UID:', uid, 'message:', message);
          settled = true;
          clearTimeout(timer);
          abortController?.abort();
          softResetNfcContext();
          resolve({ uid, message });
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
        { records: [{ recordType: 'mime', mediaType: 'text/plain', data: new TextEncoder().encode(data) }] },
        { signal: abortController!.signal, overwrite: true }
      )
      .then(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          abortController?.abort();
          softResetNfcContext();
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

export interface ScanAndWriteResult {
  uid: string;
  message?: string;
}

/**
 * Combined scan + write: reads the tag UID and existing data, then calls
 * getWriteData with the result. If getWriteData returns a string, that
 * data is written to the tag immediately (same tap). If it returns null,
 * no write happens. This avoids the "second tap" problem.
 */
export const scanAndWriteNfcTag = (
  getWriteData: (result: NfcScanResult) => Promise<string | null>,
  timeoutMs = 30000,
  onStatusChange?: (status: 'scanning' | 'writing') => void,
): { promise: Promise<ScanAndWriteResult>; cancel: () => void } => {
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

  const promise = new Promise<ScanAndWriteResult>((resolve, reject) => {
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
        console.log('[NFC] Scan+Write started, waiting for tag...');
        onStatusChange?.('scanning');

        reader.onreading = async (event: any) => {
          if (settled) return;
          const uid = event.serialNumber?.replace(/:/g, '').toUpperCase() || '';
          let message: string | undefined;
          if (event.message?.records) {
            for (const rec of event.message.records) {
              try {
                if (rec.recordType === 'text' || rec.recordType === 'mime') {
                  const decoder = new TextDecoder(rec.encoding || 'utf-8');
                  message = decoder.decode(rec.data);
                  break;
                }
              } catch { /* ignore */ }
            }
          }
          console.log('[NFC] Tag read, UID:', uid, 'message:', message);

          try {
            const writeData = await getWriteData({ uid, message });
            if (writeData !== null && !settled) {
              onStatusChange?.('writing');
              console.log('[NFC] Writing data:', writeData);
              const writer = new (window as any).NDEFReader();
              await writer.write(
                { records: [{ recordType: 'text', data: writeData }] },
                { overwrite: true }
              );
              console.log('[NFC] Write successful');
            }
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              abortController?.abort();
              softResetNfcContext();
              resolve({ uid, message });
            }
          } catch (err: any) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              abortController?.abort();
              reject(err);
            }
          }
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
