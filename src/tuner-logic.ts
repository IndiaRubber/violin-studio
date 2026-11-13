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

// ---- Milestone 2C presentation helpers (no change to detection or thresholds) ----

export type TunerMode = 'violin' | 'chromatic';
export type TuningDirection = 'In tune' | 'Tune up' | 'Tune down';

/** Inside the existing ±TUNER_IN_TUNE_CENTS band the string is in tune, even a few cents off zero. */
export function tuningDirection(cents: number, band = TUNER_IN_TUNE_CENTS): TuningDirection {
  return Math.abs(cents) <= band ? 'In tune' : cents < 0 ? 'Tune up' : 'Tune down';
}

/** The open string nearest the pitch (the same rule classifyString uses), with its distance in cents. */
export function nearestString(hz: number, a4 = 440) {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  return VIOLIN_STRINGS.map(note => ({ note, distance: Math.abs(centsFromTarget(hz, referenceFrequency(note.midi, a4))) })).sort((a, b) => a.distance - b.distance)[0];
}

export interface TunerReadout {
  /** Identity of the active target; the trail restarts when it changes. */
  targetKey: string | null;
  /** Violin string highlighted on the pegbox (none in Chromatic). */
  peg: string | null;
  /** Note and octave the microphone hears, e.g. "A4". */
  hearing: string | null;
  /** Cents relative to the target, only when the reading is a valid reading of that target. */
  cents: number | null;
  direction: TuningDirection | null;
  /** Shown instead of a direction when the heard note is not the target. */
  mismatch: string | null;
}

const letter = (id: string) => VIOLIN_STRINGS.find(s => s.id === id)?.name.replace(/\d/, '') ?? id;

/**
 * What the tuner should show for a display frequency.
 * - Chromatic: target is the nearest note; no peg is implied.
 * - Violin Auto: target is the nearest open string within 300 cents (classifyString's rule).
 * - Violin Manual: target is the selected string. A different note is reported as
 *   "Target D · Hearing A4" and is never plotted as a sharp or flat D.
 * `previousAuto` keeps the auto-selected string through silence.
 */
export function tunerReadout(hz: number | null, opts: { mode: TunerMode; auto: boolean; selectedId: string; a4: number; previousAuto?: string | null }): TunerReadout {
  const { mode, auto, selectedId, a4 } = opts;
  const heard = hz === null ? null : nearestNote(hz, a4);
  const hearing = heard?.name ?? null;
  if (mode === 'chromatic') {
    if (!heard) return { targetKey: null, peg: null, hearing: null, cents: null, direction: null, mismatch: null };
    return { targetKey: `note:${heard.midi}`, peg: null, hearing, cents: heard.cents, direction: tuningDirection(heard.cents), mismatch: null };
  }
  if (auto) {
    const near = hz === null ? null : nearestString(hz, a4);
    if (hz === null || !near) {
      const peg = opts.previousAuto ?? null;
      return { targetKey: peg ? `string:${peg}` : null, peg, hearing: null, cents: null, direction: null, mismatch: null };
    }
    if (near.distance > 301) {
      const peg = opts.previousAuto ?? null;
      return { targetKey: peg ? `string:${peg}` : null, peg, hearing, cents: null, direction: null, mismatch: `Hearing ${hearing} · not near an open string` };
    }
    const cents = centsFromTarget(hz, referenceFrequency(near.note.midi, a4));
    return { targetKey: `string:${near.note.id}`, peg: near.note.id, hearing, cents, direction: tuningDirection(cents), mismatch: null };
  }
  const targetKey = `string:${selectedId}`;
  if (hz === null) return { targetKey, peg: selectedId, hearing: null, cents: null, direction: null, mismatch: null };
  const result = classifyString(hz, selectedId, a4);
  if (result.kind === 'selected') return { targetKey, peg: selectedId, hearing, cents: result.cents, direction: tuningDirection(result.cents!), mismatch: null };
  const note = result.kind === 'octave' ? ' (octave)' : '';
  return { targetKey, peg: selectedId, hearing, cents: null, direction: null, mismatch: `Target ${letter(selectedId)} · Hearing ${hearing}${note}` };
}
