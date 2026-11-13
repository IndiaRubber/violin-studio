import { ExerciseEngine } from './exercise';
import type { PracticeNote } from './music';
import type { PitchReading } from './pitch';
import { SustainEngine, type PracticeEvaluation } from './sustain';
import { DEFAULT_BPM, noteMs, WHOLE_NOTE_BEATS } from './tempo';

/** 'sustain' = guided practice (find the pitch, then hold its written duration); 'quick' = recognition only. */
export type PracticeMode = 'sustain' | 'quick';

export const initialPracticeEvaluation = (bpm = DEFAULT_BPM, beats = WHOLE_NOTE_BEATS): PracticeEvaluation => ({ index: 0, complete: false, phase: 'find', state: 'quiet', stableMs: 0, cents: null, advanced: false, holdMs: 0, requiredMs: noteMs(beats, bpm), beats, beat: 0, faultMs: 0, reset: null });

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
    const sustain = this.engine instanceof SustainEngine ? this.engine : null;
    const timing = { requiredMs: sustain?.requiredMs ?? 0, beats: sustain?.beats ?? 0 };
    if (this.isSuppressed(now)) {
      this.engine.interrupt();
      const complete = this.engine.index >= this.notes.length;
      return { index: this.engine.index, complete, phase: complete ? 'complete' : 'find', state: 'reference', stableMs: 0, cents: null, advanced: false, holdMs: 0, ...timing, beat: 0, faultMs: 0, reset: null };
    }
    if (sustain) return sustain.evaluate(reading, now);
    const quick = (this.engine as ExerciseEngine).evaluate(reading, now);
    return { ...quick, phase: quick.complete ? 'complete' : quick.state === 'release' ? 'release' : 'find', holdMs: 0, ...timing, beat: 0, faultMs: 0, reset: null };
  }
}
