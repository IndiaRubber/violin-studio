import { centsFromTarget, OPEN_STRINGS } from './music';
import type { PitchReading } from './pitch';
import { referenceFrequency } from './reference';

export { MIN_A4, MAX_A4, referenceFrequency } from './reference';
export const TUNER_IN_TUNE_CENTS = 10;
export function formatCents(cents: number): string { const rounded = Math.round(cents); return `${rounded > 0 ? '+' : ''}${rounded} cents`; }
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function nearestNote(hz: number, a4 = 440) {
  if (!Number.isFinite(hz) || hz <= 0 || !Number.isFinite(a4) || a4 <= 0) return null;
  const midi = Math.round(69 + 12 * Math.log2(hz / a4));
  return { midi, name: `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`, targetHz: referenceFrequency(midi, a4), cents: centsFromTarget(hz, referenceFrequency(midi, a4)) };
}

export const VIOLIN_STRINGS = OPEN_STRINGS.map((note, index) => ({ ...note, midi: [55, 62, 69, 76][index] }));
export function classifyString(hz: number, selectedId: string, a4 = 440) {
  const selected = VIOLIN_STRINGS.find(note => note.id === selectedId);
  if (!selected || !Number.isFinite(hz) || hz <= 0) return { kind: 'unsupported' as const, cents: null, message: 'No reliable pitch.' };
  const cents = centsFromTarget(hz, referenceFrequency(selected.midi, a4));
  const nearest = VIOLIN_STRINGS.map(note => ({ note, distance: Math.abs(centsFromTarget(hz, referenceFrequency(note.midi, a4))) })).sort((a, b) => a.distance - b.distance)[0];
  if (Math.abs(cents) <= 301 && nearest.note.id === selectedId) {
    const message = Math.abs(cents) <= TUNER_IN_TUNE_CENTS ? 'In tune' : `${Math.abs(cents) > 50 ? 'Very ' : ''}${cents < 0 ? 'flat — tune higher.' : 'sharp — tune lower.'}`;
    return { kind: 'selected' as const, cents, message: message[0].toUpperCase() + message.slice(1) };
  }
  if (Math.abs(Math.abs(cents) - 1200) < 120) return { kind: 'octave' as const, cents, message: 'Possible octave mismatch — check the selected string.' };
  if (nearest.distance <= 300 && nearest.note.id !== selectedId) return { kind: 'other' as const, cents, message: `Pitch is nearer ${nearest.note.name}; check the selected string.` };
  return { kind: 'outside' as const, cents, message: 'Pitch is outside the selected string’s tuning range.' };
}

// The capture pipeline decides whether a frame is trustworthy. This filter only
// calms visible jitter; rejected frames never inherit its previous value.
export class TunerPresentation {
  private previous: number | null = null;
  private rejected = 0;
  next(reading: PitchReading): number | null {
    if (reading.reason !== 'ok' || reading.rawHz === null) {
      if (reading.reason === 'quiet' || ++this.rejected > 2) this.reset();
      return null;
    }
    this.rejected = 0;
    const hz = reading.rawHz;
    if (this.previous === null || Math.abs(centsFromTarget(hz, this.previous)) > 70) this.previous = hz;
    else this.previous *= 2 ** (0.45 * Math.log2(hz / this.previous));
    return this.previous;
  }
  reset() { this.previous = null; this.rejected = 0; }
}
