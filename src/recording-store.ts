import { openPracticeDb, type PracticeEvent } from './practice-history';

export interface SavedRecording {
  id: string;
  exerciseId: string;
  title: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
}

/** Recording and diary entry commit together, or neither does. */
export async function saveRecording(recording: SavedRecording, event: PracticeEvent): Promise<void> {
  const db = await openPracticeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['recordings', 'events'], 'readwrite');
    tx.objectStore('recordings').put(recording);
    tx.objectStore('events').put(event);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not save recording.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Could not save recording.')); };
  });
}
export async function loadRecording(id: string): Promise<SavedRecording | undefined> {
  const db = await openPracticeDb();
  return new Promise((resolve, reject) => {
    let result: SavedRecording | undefined;
    const tx = db.transaction('recordings', 'readonly');
    const request = tx.objectStore('recordings').get(id) as IDBRequest<SavedRecording | undefined>;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not load recording.')); };
  });
}
export async function deleteRecording(id: string, eventId: string): Promise<void> {
  const db = await openPracticeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['recordings', 'events'], 'readwrite');
    tx.objectStore('recordings').delete(id);
    tx.objectStore('events').delete(eventId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not delete recording.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Could not delete recording.')); };
  });
}
