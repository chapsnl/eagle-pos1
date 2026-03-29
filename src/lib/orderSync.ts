// Shared localStorage sync for live order broadcasting between pages

export interface SyncOrderItem {
  product_id: string;
  product_name: string;
  shorthand: string;
  price: number;
  quantity: number;
}

export interface SyncOrderState {
  guestNumber: string; // e.g. "C123"
  sessionId: string | null;
  items: SyncOrderItem[];
  totalAmount: number;
  timestamp: number;
}

const STORAGE_KEY = 'active_order';
const EVENT_NAME = 'active_order_update';

export function broadcastOrder(state: SyncOrderState) {
  const json = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, json);
  // Dispatch custom event for same-tab listeners (storage event only fires cross-tab)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
}

export function readOrder(): SyncOrderState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncOrderState;
  } catch {
    return null;
  }
}

export function clearOrder() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
}

export function onOrderUpdate(callback: (state: SyncOrderState | null) => void): () => void {
  // Same-tab custom events
  const handleCustom = (e: Event) => {
    callback((e as CustomEvent).detail ?? null);
  };
  // Cross-tab storage events
  const handleStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    if (!e.newValue) { callback(null); return; }
    try { callback(JSON.parse(e.newValue)); } catch { callback(null); }
  };

  window.addEventListener(EVENT_NAME, handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}
