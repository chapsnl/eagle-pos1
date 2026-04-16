/**
 * Offline Queue Manager
 * Queues all POS write operations in IndexedDB and flushes them
 * to Supabase when online. The UI never waits for network.
 */
import { get, set, del, keys } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────

export type QueueAction =
  | { type: 'create_session'; payload: { tempId: string; wardrobe_number: string; is_event_numbered?: boolean; nfc_uid?: string } }
  | { type: 'insert_drink_logs'; payload: { session_id: string; logs: { product_id: string; price_at_time: number }[] } }
  | { type: 'update_session'; payload: { id: string; total_amount?: number; status?: string; actual_paid_amount?: number } }
  | { type: 'lock_session'; payload: { id: string; locked_by: string } }
  | { type: 'unlock_session'; payload: { id: string } };

interface QueueEntry {
  id: string;
  action: QueueAction;
  createdAt: number;
  retries: number;
}

// Map temp session IDs → real IDs once resolved
const tempIdMap = new Map<string, string>();

const QUEUE_PREFIX = 'oq_';
const queueKey = (id: string) => `${QUEUE_PREFIX}${id}`;

// ── Public API ─────────────────────────────────────────────────────

let _flushing = false;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Enqueue a write action for background processing */
export async function enqueue(action: QueueAction): Promise<void> {
  const entry: QueueEntry = {
    id: crypto.randomUUID(),
    action,
    createdAt: Date.now(),
    retries: 0,
  };
  await set(queueKey(entry.id), entry);
  scheduleFlush();
}

/** Get count of pending items */
export async function pendingCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter(k => String(k).startsWith(QUEUE_PREFIX)).length;
}

/** Check if browser is online */
export function isOnline(): boolean {
  return navigator.onLine;
}

/** Force an immediate flush attempt */
export function scheduleFlush(delayMs = 100): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => flush(), delayMs);
}

/** Resolve a temp session ID to real ID (for in-flight lookups) */
export function resolveSessionId(idOrTemp: string): string {
  return tempIdMap.get(idOrTemp) ?? idOrTemp;
}

// ── Flush engine ───────────────────────────────────────────────────

async function flush(): Promise<void> {
  if (_flushing || !navigator.onLine) return;
  _flushing = true;

  try {
    const allKeys = await keys();
    const queueKeys = allKeys
      .filter(k => String(k).startsWith(QUEUE_PREFIX))
      .map(String)
      .sort(); // process in insertion order

    for (const key of queueKeys) {
      const entry = await get<QueueEntry>(key);
      if (!entry) { await del(key); continue; }

      const success = await processEntry(entry);
      if (success) {
        await del(key);
      } else {
        // Retry later — bump retry count
        entry.retries += 1;
        if (entry.retries > 20) {
          // Give up after 20 retries — discard to avoid infinite loop
          console.error('[OfflineQueue] Discarding entry after 20 retries:', entry);
          await del(key);
        } else {
          await set(key, entry);
          // Stop processing — retry after delay
          scheduleFlush(Math.min(entry.retries * 2000, 30000));
          break;
        }
      }
    }
  } finally {
    _flushing = false;
  }
}

async function processEntry(entry: QueueEntry): Promise<boolean> {
  const { action } = entry;

  try {
    switch (action.type) {
      case 'create_session': {
        const { tempId, ...insertData } = action.payload;
        // Check if session with this wardrobe_number already exists
        const { data: existing } = await supabase
          .from('sessions')
          .select('id')
          .eq('wardrobe_number', insertData.wardrobe_number)
          .eq('status', 'active')
          .maybeSingle();
        
        if (existing) {
          tempIdMap.set(tempId, existing.id);
          return true;
        }
        
        const { data: session, error } = await supabase
          .from('sessions')
          .insert(insertData)
          .select('id')
          .single();
        if (error) throw error;
        tempIdMap.set(tempId, session.id);
        return true;
      }

      case 'insert_drink_logs': {
        const realSessionId = resolveSessionId(action.payload.session_id);
        const rows = action.payload.logs.map(l => ({
          session_id: realSessionId,
          product_id: l.product_id,
          price_at_time: l.price_at_time,
        }));
        const { error } = await supabase.from('drink_logs').insert(rows);
        if (error) throw error;
        return true;
      }

      case 'update_session': {
        const realId = resolveSessionId(action.payload.id);
        const { id, ...updates } = action.payload;
        const { error } = await supabase.from('sessions').update(updates).eq('id', realId);
        if (error) throw error;
        return true;
      }

      case 'lock_session': {
        const realId = resolveSessionId(action.payload.id);
        const { error } = await supabase.from('sessions')
          .update({ locked_by: action.payload.locked_by, locked_at: new Date().toISOString() } as any)
          .eq('id', realId);
        if (error) throw error;
        return true;
      }

      case 'unlock_session': {
        const realId = resolveSessionId(action.payload.id);
        const { error } = await supabase.from('sessions')
          .update({ locked_by: null, locked_at: null } as any)
          .eq('id', realId);
        if (error) throw error;
        return true;
      }

      default:
        return true;
    }
  } catch (err) {
    console.warn('[OfflineQueue] Failed to process entry:', err);
    return false;
  }
}

// ── Auto-flush on reconnect ────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Back online — flushing queue');
    scheduleFlush(500);
  });

  // Also flush periodically when online (catch stragglers)
  setInterval(() => {
    if (navigator.onLine) scheduleFlush(0);
  }, 15000);
}
