import type { PracticeSummary } from './Practice';

export const HISTORY_DB = 'violin-studio-practice-data';
export const HISTORY_VERSION = 1;
export type PracticeEventType = 'warmup' | 'lesson' | 'recording';
export interface PracticeEvent {
  id: string;
  type: PracticeEventType;
  title: string;
  completedAt: string;
  activityId?: string;
  exerciseId?: string;
  summary?: PracticeSummary;
  durationMs?: number;
  recordingId?: string;
}
export const WARMUPS = [
  { id: 'bowing', title: 'Right-hand bowing', minutes: 3, description: 'Slow open-string strokes. Aim for a straight bow and smooth changes.' },
  { id: 'placement', title: 'Left-hand placement', minutes: 3, description: 'Place and lift first-position fingers silently. Compare low and high second finger spacing.' },
  { id: 'posture', title: 'Posture and relaxation', minutes: 2, description: 'Set up comfortably. Notice relaxed shoulders, wrist, and bow grip.' },
] as const;

export function localDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function groupByDay(events: PracticeEvent[]): [string, PracticeEvent[]][] {
  const days = new Map<string, PracticeEvent[]>();
  for (const event of [...events].sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id))) {
    const key = localDay(event.completedAt);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
}
export function warmupEvent(activityId: string, title: string, completedAt = new Date().toISOString(), id: string = crypto.randomUUID()): PracticeEvent {
  return { id, type: 'warmup', activityId, title, completedAt };
}
export function lessonEvent(summary: PracticeSummary, completedAt = new Date().toISOString(), id: string = crypto.randomUUID()): PracticeEvent {
  return { id, type: 'lesson', exerciseId: summary.exerciseId, title: summary.title, completedAt, summary };
}

export function openPracticeDb(version = HISTORY_VERSION): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Local practice storage is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local practice storage.'));
    request.onblocked = () => reject(new Error('Practice storage is busy in another tab. Close other Violin Studio tabs and retry.'));
  });
}

async function eventRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openPracticeDb();
  return new Promise((resolve, reject) => {
    let value: T;
    const tx = db.transaction('events', mode);
    const request = operation(tx.objectStore('events'));
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not save practice history.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Could not save practice history.')); };
  });
}
export async function listPracticeEvents(): Promise<PracticeEvent[]> { return eventRequest('readonly', store => store.getAll() as IDBRequest<PracticeEvent[]>); }
export async function addPracticeEvent(event: PracticeEvent): Promise<void> { await eventRequest('readwrite', store => store.put(event)); }
export async function deletePracticeEvent(id: string): Promise<void> { await eventRequest('readwrite', store => store.delete(id)); }
