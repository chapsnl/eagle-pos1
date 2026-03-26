/**
 * NFC helper – supports Fully Kiosk Browser (Android JS interface) AND Web NFC (NDEFReader).
 * Fully Kiosk is checked first since that's the target runtime on Sunmi/Pax handhelds.
 */

declare global {
  interface Window {
    Android?: {
      useJavaScriptCallbackNFC?: (enable: boolean) => void;
    };
    nfcScanResult?: (data: string) => void;
    nfcScanResultMifareUltralight?: (data: string) => void;
  }
}

export interface NfcScanResult {
  uid: string;
  message?: string;
}

/** Check if Fully Kiosk NFC bridge is available */
const isFullyKiosk = (): boolean =>
  typeof window.Android !== 'undefined' &&
  typeof window.Android?.useJavaScriptCallbackNFC === 'function';

/** Check if Web NFC is available (Chrome on Android) */
const isWebNfc = (): boolean => 'NDEFReader' in window;

export const isNfcSupported = (): boolean => isFullyKiosk() || isWebNfc();

/**
 * Scan NFC via Fully Kiosk Browser's Android JS interface.
 */
const scanFullyKiosk = (timeoutMs: number): Promise<NfcScanResult> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Clean up callbacks
      window.nfcScanResult = undefined;
      window.nfcScanResultMifareUltralight = undefined;
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    const handleResult = (data: string) => {
      clearTimeout(timer);
      window.nfcScanResult = undefined;
      window.nfcScanResultMifareUltralight = undefined;
      // Fully Kiosk returns the UID/serial as the data string for NDEF tags
      // For Mifare Ultralight it returns JSON with uid field
      const uid = data.trim();
      if (uid) {
        resolve({ uid });
      } else {
        reject(new Error('NFC_READ_ERROR'));
      }
    };

    const handleMifare = (data: string) => {
      clearTimeout(timer);
      window.nfcScanResult = undefined;
      window.nfcScanResultMifareUltralight = undefined;
      try {
        const pages = JSON.parse(data);
        // First page usually contains the UID
        const uidPage = pages.find((p: any) => p.uid);
        if (uidPage?.uid) {
          resolve({ uid: uidPage.uid });
        } else if (pages[0]?.hex) {
          resolve({ uid: pages[0].hex });
        } else {
          reject(new Error('NFC_READ_ERROR'));
        }
      } catch {
        reject(new Error('NFC_READ_ERROR'));
      }
    };

    // Register global callbacks that Fully Kiosk will call
    window.nfcScanResult = handleResult;
    window.nfcScanResultMifareUltralight = handleMifare;

    // Tell Fully Kiosk to start sending NFC results via JS callback
    window.Android!.useJavaScriptCallbackNFC!(true);
  });
};

/**
 * Scan NFC via Web NFC API (NDEFReader) — Chrome on Android only.
 */
const scanWebNfc = (timeoutMs: number): Promise<NfcScanResult> => {
  return new Promise(async (resolve, reject) => {
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
        controller.abort();
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
 * Perform an NFC scan. Uses Fully Kiosk first, falls back to Web NFC.
 */
export const scanNfc = (timeoutMs = 15000): Promise<NfcScanResult> => {
  if (isFullyKiosk()) {
    return scanFullyKiosk(timeoutMs);
  }
  if (isWebNfc()) {
    return scanWebNfc(timeoutMs);
  }
  return Promise.reject(new Error('NFC_NOT_SUPPORTED'));
};

/**
 * Write an NDEF text record to a tag.
 * Note: Fully Kiosk Browser does not support NFC writing via JS interface.
 * Only Web NFC supports writing.
 */
export const writeNfc = (text: string, timeoutMs = 15000): Promise<NfcScanResult> => {
  return new Promise(async (resolve, reject) => {
    if (!isWebNfc()) {
      return reject(new Error('NFC_WRITE_NOT_SUPPORTED'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('NFC_TIMEOUT'));
    }, timeoutMs);

    try {
      const writer = new (window as any).NDEFReader();
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
