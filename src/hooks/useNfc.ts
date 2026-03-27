/**
 * Hybrid NFC helper.
 * Uses @capgo/capacitor-nfc when running inside Capacitor native shell,
 * falls back to Web NFC (NDEFReader) in the browser.
 */
import { Capacitor } from '@capacitor/core';

export interface NfcScanResult {
  uid: string;
  message?: string;
}

/* ------------------------------------------------------------------ */
/*  NDEF helpers for @capgo/capacitor-nfc                              */
/* ------------------------------------------------------------------ */

/** Build a well-known Text NDEF record (TNF=1, type='T'). */
function buildNdefTextRecord(text: string) {
  const lang = 'en';
  const langBytes = Array.from(new TextEncoder().encode(lang));
  const textBytes = Array.from(new TextEncoder().encode(text));
  const statusByte = langBytes.length; // UTF-8, no BOM
  return {
    tnf: 1,
    type: [0x54], // 'T'
    id: [],
    payload: [statusByte, ...langBytes, ...textBytes],
  };
}

/** Decode the text from a TNF=1, type='T' NDEF record payload. */
function decodeNdefText(payload: number[]): string {
  if (!payload || payload.length < 2) return '';
  const langLen = payload[0] & 0x3f;
  const textBytes = payload.slice(1 + langLen);
  return new TextDecoder().decode(new Uint8Array(textBytes));
}

/** Convert a tag id byte array to uppercase hex string (no separators). */
function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Capacitor-based NFC (native)                                       */
/* ------------------------------------------------------------------ */

function scanNfcCapacitor(timeoutMs: number): { promise: Promise<NfcScanResult>; cancel: () => void } {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let listenerHandle: any = null;

  const cancel = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    import('@capgo/capacitor-nfc').then(({ CapacitorNfc }) => {
      CapacitorNfc.stopScanning().catch(() => {});
    });
    listenerHandle?.remove?.();
  };

  const promise = new Promise<NfcScanResult>(async (resolve, reject) => {
    try {
      const { CapacitorNfc } = await import('@capgo/capacitor-nfc');

      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          CapacitorNfc.stopScanning().catch(() => {});
          listenerHandle?.remove?.();
          reject(new Error('NFC_TIMEOUT'));
        }
      }, timeoutMs);

      listenerHandle = await CapacitorNfc.addListener('ndefDiscovered', (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const uid = event.tag.id ? bytesToHex(event.tag.id) : '';
        let message: string | undefined;

        if (event.tag.ndefMessage) {
          for (const rec of event.tag.ndefMessage) {
            if (rec.tnf === 1 && rec.type?.length === 1 && rec.type[0] === 0x54) {
              const text = decodeNdefText(rec.payload);
              if (text) { message = text; break; }
            }
          }
        }

        CapacitorNfc.stopScanning().catch(() => {});
        listenerHandle?.remove?.();
        console.log('[NFC-Cap] Tag read, UID:', uid, 'message:', message);
        resolve({ uid, message });
      });

      await CapacitorNfc.startScanning({ iosSessionType: 'tag' });
      console.log('[NFC-Cap] Scan started, waiting for tag...');
    } catch (err) {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    }
  });

  return { promise, cancel };
}

function writeNfcCapacitor(data: string, timeoutMs: number): { promise: Promise<void>; cancel: () => void } {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let listenerHandle: any = null;

  const cancel = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    import('@capgo/capacitor-nfc').then(({ CapacitorNfc }) => {
      CapacitorNfc.stopScanning().catch(() => {});
    });
    listenerHandle?.remove?.();
  };

  const promise = new Promise<void>(async (resolve, reject) => {
    try {
      const { CapacitorNfc } = await import('@capgo/capacitor-nfc');
      const record = buildNdefTextRecord(data);

      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          CapacitorNfc.stopScanning().catch(() => {});
          listenerHandle?.remove?.();
          reject(new Error('NFC_TIMEOUT'));
        }
      }, timeoutMs);

      listenerHandle = await CapacitorNfc.addListener('ndefDiscovered', async () => {
        if (settled) return;
        try {
          await CapacitorNfc.write({ records: [record] });
          settled = true;
          clearTimeout(timer);
          CapacitorNfc.stopScanning().catch(() => {});
          listenerHandle?.remove?.();
          console.log('[NFC-Cap] Write successful');
          resolve();
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            CapacitorNfc.stopScanning().catch(() => {});
            listenerHandle?.remove?.();
            reject(err);
          }
        }
      });

      await CapacitorNfc.startScanning({ iosSessionType: 'tag' });
      console.log('[NFC-Cap] Write started, waiting for tag to write:', data);
    } catch (err) {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    }
  });

  return { promise, cancel };
}

/** Erase: write empty NDEF message using Capacitor plugin's erase() */
function eraseNfcCapacitor(timeoutMs: number): { promise: Promise<{ uid: string; wn?: string }>; cancel: () => void } {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let listenerHandle: any = null;

  const cancel = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    import('@capgo/capacitor-nfc').then(({ CapacitorNfc }) => {
      CapacitorNfc.stopScanning().catch(() => {});
    });
    listenerHandle?.remove?.();
  };

  const promise = new Promise<{ uid: string; wn?: string }>(async (resolve, reject) => {
    try {
      const { CapacitorNfc } = await import('@capgo/capacitor-nfc');
      const emptyRecord = buildNdefTextRecord('0');

      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          CapacitorNfc.stopScanning().catch(() => {});
          listenerHandle?.remove?.();
          reject(new Error('NFC_TIMEOUT'));
        }
      }, timeoutMs);

      listenerHandle = await CapacitorNfc.addListener('ndefDiscovered', async (event) => {
        if (settled) return;

        const uid = event.tag.id ? bytesToHex(event.tag.id) : '';
        let wn: string | undefined;

        // Extract wardrobe number before erasing
        if (event.tag.ndefMessage) {
          for (const rec of event.tag.ndefMessage) {
            if (rec.tnf === 1 && rec.type?.length === 1 && rec.type[0] === 0x54) {
              try {
                const text = decodeNdefText(rec.payload);
                const json = JSON.parse(text);
                if (json.wn) wn = json.wn;
              } catch { /* ignore */ }
            }
          }
        }

        try {
          await CapacitorNfc.write({ records: [emptyRecord] });
          settled = true;
          clearTimeout(timer);
          CapacitorNfc.stopScanning().catch(() => {});
          listenerHandle?.remove?.();
          console.log('[NFC-Cap] Erase successful, UID:', uid);
          resolve({ uid, wn });
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            CapacitorNfc.stopScanning().catch(() => {});
            listenerHandle?.remove?.();
            reject(err);
          }
        }
      });

      await CapacitorNfc.startScanning({ iosSessionType: 'tag' });
    } catch (err) {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    }
  });

  return { promise, cancel };
}

/* ------------------------------------------------------------------ */
/*  Web NFC fallback (NDEFReader)                                      */
/* ------------------------------------------------------------------ */

function scanNfcWeb(timeoutMs: number): { promise: Promise<NfcScanResult>; cancel: () => void } {
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
      if (!settled) { settled = true; abortController?.abort(); reject(new Error('NFC_TIMEOUT')); }
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
                if (rec.recordType === 'text') {
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
          resolve({ uid, message });
        };
        reader.onreadingerror = () => { console.warn('[NFC] Read error'); };
      })
      .catch((err: Error) => {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      });
  });

  return { promise, cancel };
}

function writeNfcWeb(data: string, timeoutMs: number): { promise: Promise<void>; cancel: () => void } {
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
      if (!settled) { settled = true; abortController?.abort(); reject(new Error('NFC_TIMEOUT')); }
    }, timeoutMs);

    const writer = new (window as any).NDEFReader();
    console.log('[NFC] Write started, waiting for tag to write:', data);
    writer
      .write(
        { records: [{ recordType: 'text', data }] },
        { signal: abortController!.signal, overwrite: true }
      )
      .then(() => {
        if (!settled) { settled = true; clearTimeout(timer); console.log('[NFC] Write successful'); resolve(); }
      })
      .catch((err: Error) => {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      });
  });

  return { promise, cancel };
}

function eraseNfcWeb(timeoutMs: number): { promise: Promise<{ uid: string; wn?: string }>; cancel: () => void } {
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

  const promise = new Promise<{ uid: string; wn?: string }>((resolve, reject) => {
    if (!('NDEFReader' in window)) {
      settled = true;
      reject(new Error('NFC_NOT_SUPPORTED'));
      return;
    }

    timer = setTimeout(() => {
      if (!settled) { settled = true; abortController?.abort(); reject(new Error('NFC_TIMEOUT')); }
    }, timeoutMs);

    const reader = new (window as any).NDEFReader();
    reader
      .scan({ signal: abortController!.signal })
      .then(() => {
        reader.onreading = async (event: any) => {
          if (settled) return;
          const uid = event.serialNumber?.replace(/:/g, '').toUpperCase() || '';
          let wn: string | undefined;

          if (event.message?.records) {
            for (const rec of event.message.records) {
              try {
                if (rec.recordType === 'text') {
                  const decoder = new TextDecoder(rec.encoding || 'utf-8');
                  const text = decoder.decode(rec.data);
                  const json = JSON.parse(text);
                  if (json.wn) wn = json.wn;
                }
              } catch { /* ignore */ }
            }
          }

          try {
            const writer = new (window as any).NDEFReader();
            await writer.write(
              { records: [{ recordType: 'text', data: '' }] },
              { overwrite: true }
            );
            settled = true;
            clearTimeout(timer);
            abortController?.abort();
            resolve({ uid, wn });
          } catch (err) {
            if (!settled) { settled = true; clearTimeout(timer); abortController?.abort(); reject(err as Error); }
          }
        };
      })
      .catch((err: Error) => {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      });
  });

  return { promise, cancel };
}

/* ------------------------------------------------------------------ */
/*  Public API — auto-selects native vs web implementation             */
/* ------------------------------------------------------------------ */

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export const scanNfcTag = (timeoutMs = 30000) =>
  isNative() ? scanNfcCapacitor(timeoutMs) : scanNfcWeb(timeoutMs);

export const writeNfcTag = (data: string, timeoutMs = 30000) =>
  isNative() ? writeNfcCapacitor(data, timeoutMs) : writeNfcWeb(data, timeoutMs);

export const eraseNfcTag = (timeoutMs = 30000) =>
  isNative() ? eraseNfcCapacitor(timeoutMs) : eraseNfcWeb(timeoutMs);
