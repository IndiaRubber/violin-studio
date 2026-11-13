import { frequencyOf, spell, vexKey, type Accidental, type Duration, type WrittenPitch } from './notation';

export type ViolinString = 'G' | 'D' | 'A' | 'E';
/** Suggested fingering. `high` marks a high 2nd finger (major third above the open string). */
export interface Fingering { string: ViolinString; finger: 0 | 1 | 2 | 3 | 4; high?: boolean }

/** The note shape used by the engines and the staff. `name` is the written spelling, e.g. "F♯4". */
export interface PracticeNote {
  id: string;
  name: string;
  frequency: number;
  vexKey: string;
  /** Quarter-note beats (defaults to 4, a whole note). */
  beats?: number;
  duration?: Duration;
  measure?: number;
  /** Accidental glyph to print (null when the key signature or an earlier note covers it). */
  accidental?: Accidental | null;
  fingering?: Fingering;
}

const openString = (id: string, pitch: WrittenPitch): PracticeNote => ({ id, name: spell(pitch), frequency: frequencyOf(pitch), vexKey: vexKey(pitch) });
/** Open strings at A4 = 440, derived from spelling (G3 ≈ 196.00 Hz … E5 ≈ 659.26 Hz). */
export const OPEN_STRINGS: PracticeNote[] = [
  openString('g3', { step: 'G', octave: 3 }),
  openString('d4', { step: 'D', octave: 4 }),
  openString('a4', { step: 'A', octave: 4 }),
  openString('e5', { step: 'E', octave: 5 }),
];
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
