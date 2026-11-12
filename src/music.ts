export interface PracticeNote { id: string; name: string; frequency: number; vexKey: string; }
export const OPEN_STRINGS: PracticeNote[] = [
  { id: 'g3', name: 'G3', frequency: 196, vexKey: 'g/3' },
  { id: 'd4', name: 'D4', frequency: 293.66, vexKey: 'd/4' },
  { id: 'a4', name: 'A4', frequency: 440, vexKey: 'a/4' },
  { id: 'e5', name: 'E5', frequency: 659.26, vexKey: 'e/5' },
];
export const OPEN_STRINGS_EXERCISE = { id: 'open-strings', title: 'Open Strings Practice', notes: OPEN_STRINGS };
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function frequencyToNote(hz: number, a4 = 440): string | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  // Array.map passes an index as the second argument; only supported A4 references apply.
  const reference = Number.isFinite(a4) && a4 >= 415 && a4 <= 466 ? a4 : 440;
  const midi = Math.round(69 + 12 * Math.log2(hz / reference));
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
export function centsFromTarget(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz);
}
export function matchesTarget(hz: number, targetHz: number, toleranceCents: number): boolean {
  return Number.isFinite(hz) && hz > 0 && Math.abs(centsFromTarget(hz, targetHz)) <= toleranceCents;
}
