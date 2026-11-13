import { ExerciseEngine } from './exercise';
import { OPEN_STRINGS, type PracticeNote } from './music';
import type { PitchReading } from './pitch';
import { SustainEngine, type PracticeEvaluation } from './sustain';
import { DEFAULT_BPM, wholeNoteMs } from './tempo';

export type PracticeMode = 'sustain' | 'quick';
/** 'all' = G3–D4–A4–E5; a string id = four whole notes on that one open string. */
export type StringFocus = 'all' | 'g3' | 'd4' | 'a4' | 'e5';
export const MEASURES_PER_EXERCISE = 4;

/** Written notes for the selected focus. Each entry is one whole note in its own 4/4 measure. */
export function exerciseNotes(focus: StringFocus, source: PracticeNote[] = OPEN_STRINGS): PracticeNote[] {
  if (focus === 'all') return source.map((note, i) => ({ ...note, id: `${note.id}-${i}` }));
  const note = source.find(n => n.id === focus) ?? source[0];
  return Array.from({ length: MEASURES_PER_EXERCISE }, (_, i) => ({ ...note, id: `${note.id}-${i}` }));
}

export const initialPracticeEvaluation = (bpm = DEFAULT_BPM): PracticeEvaluation => ({ index: 0, complete: false, phase: 'find', state: 'quiet', stableMs: 0, cents: null, advanced: false, holdMs: 0, requiredMs: wholeNoteMs(bpm), beat: 0, faultMs: 0, reset: null });

/**
 * Routes microphone readings to the engine for the selected mode and enforces
 * reference-tone suppression: while suppressed, readings are discarded and any
 * partial match or hold is abandoned, so the app's own tone can never satisfy a note.
 */
export class PracticeSession {
  readonly engine: SustainEngine | ExerciseEngine;
  private suppressedUntil = -Infinity;
  constructor(readonly notes: PracticeNote[], readonly mode: PracticeMode, bpm = DEFAULT_BPM) {
    this.engine = mode === 'sustain' ? new SustainEngine(notes, bpm) : new ExerciseEngine(notes);
  }
  get index() { return this.engine.index; }
  setTempo(bpm: number) { if (this.engine instanceof SustainEngine) this.engine.setTempo(bpm); }
  restartNote() { if (this.engine instanceof SustainEngine) this.engine.restartNote(); else this.engine.interrupt(); }
  /** Ignore the microphone until `until` (same clock as readings). */
  suppress(until: number) { this.suppressedUntil = until; this.engine.interrupt(); }
  isSuppressed(now: number) { return now < this.suppressedUntil; }
  /** End of the current suppression window, so a replacement session can inherit it. */
  get suppressionEnd() { return this.suppressedUntil; }
  evaluate(reading: PitchReading, now: number): PracticeEvaluation {
    const required = this.engine instanceof SustainEngine ? this.engine.requiredMs : 0;
    if (this.isSuppressed(now)) {
      this.engine.interrupt();
      const complete = this.engine.index >= this.notes.length;
      return { index: this.engine.index, complete, phase: complete ? 'complete' : 'find', state: 'reference', stableMs: 0, cents: null, advanced: false, holdMs: 0, requiredMs: required, beat: 0, faultMs: 0, reset: null };
    }
    if (this.engine instanceof SustainEngine) return this.engine.evaluate(reading, now);
    const quick = this.engine.evaluate(reading, now);
    return { ...quick, phase: quick.complete ? 'complete' : quick.state === 'release' ? 'release' : 'find', holdMs: 0, requiredMs: 0, beat: 0, faultMs: 0, reset: null };
  }
}
