import type { PracticeNote } from './music';

export const MIN_A4 = 415;
export const MAX_A4 = 466;
const KEY = 'violin-studio-a4';
export function validReference(value: number): boolean { return Number.isInteger(value) && value >= MIN_A4 && value <= MAX_A4; }
export function referenceFrequency(midi: number, a4 = 440): number { return a4 * 2 ** ((midi - 69) / 12); }
export function scaledNotes(notes: PracticeNote[], a4: number): PracticeNote[] { return notes.map(note => ({ ...note, frequency: note.frequency * a4 / 440 })); }
export function loadReference(): number {
  try { const value = Number(localStorage.getItem(KEY)); return validReference(value) ? value : 440; } catch { return 440; }
}
export function saveReference(value: number): void { if (validReference(value)) { try { localStorage.setItem(KEY, String(value)); } catch { /* private storage unavailable */ } } }
