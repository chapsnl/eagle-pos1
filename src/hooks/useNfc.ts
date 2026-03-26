/**
 * Web NFC helper – wraps NDEFReader for scan & write.
 * Falls back gracefully when the API is unavailable (desktop browsers).
 */

export const isNfcSupported = (): boolean => 'NDEFReader' in window;

export interface NfcScanResult {
  uid: string;
  message?: string;
}

/**
 * Perform an NFC scan. Resolves with the UID when a tag is detected.
 * Rejects on timeout or user-abort.
 */
export const scanNfc = (timeoutMs = 15000): Promise<NfcScanResult> => {
  return new Promise(async (resolve, reject) => {
    if (!isNfcSupported()) {
      return reject(new Error('NFC_NOT_SUPPORTED'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    try {
      const reader = new (window as any).NDEFReader();
      await reader.scan({ signal: controller.signal });
      reader.addEventListener('reading', ({ serialNumber }: any) => {
        clearTimeout(timer);
        controller.abort(); // stop scanning
        resolve({ uid: serialNumber });
      });
      reader.addEventListener('readingerror', () => {
        clearTimeout(timer);
        controller.abort();
        reject(new Error('NFC_READ_ERROR'));
      });
    } catch (err: any) {
      clearTimeout(timer);
      reject(err);
    }
  });
};

/**
 * Write an NDEF text record to a tag. Resolves when the write succeeds.
 */
export const writeNfc = (text: string, timeoutMs = 15000): Promise<NfcScanResult> => {
  return new Promise(async (resolve, reject) => {
    if (!isNfcSupported()) {
      return reject(new Error('NFC_NOT_SUPPORTED'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    try {
      const writer = new (window as any).NDEFReader();
      // We need to scan first to detect the tag, then write
      await writer.scan({ signal: controller.signal });
      writer.addEventListener('reading', async ({ serialNumber }: any) => {
        try {
          await writer.write({ records: [{ recordType: 'text', data: text }] }, { signal: controller.signal });
          clearTimeout(timer);
          controller.abort();
          resolve({ uid: serialNumber });
        } catch (writeErr) {
          clearTimeout(timer);
          controller.abort();
          reject(writeErr);
        }
      });
    } catch (err: any) {
      clearTimeout(timer);
      reject(err);
    }
  });
};
