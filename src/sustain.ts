import { PRACTICE, SUSTAIN } from './config';
import { centsFromTarget, matchesTarget, type PracticeNote } from './music';
import type { PitchReading } from './pitch';
import { beatPosition, clampTempo, DEFAULT_BPM, noteMs, WHOLE_NOTE_BEATS } from './tempo';

export interface SustainSettings {
  toleranceCents: number; stableMs: number; maxGapMs: number; releaseMs: number; transitionMs: number;
  holdToleranceCents: number; holdGraceMs: number; maxFaultFraction: number;
}
export const SUSTAIN_SETTINGS: SustainSettings = { ...PRACTICE, ...SUSTAIN };

export type PracticePhase = 'find' | 'hold' | 'release' | 'complete';
export type PracticeState = 'quiet' | 'uncertain' | 'outlier' | 'wrong' | 'matching' | 'holding' | 'wavering' | 'release' | 'complete' | 'reference';
export type ResetReason = 'lost' | 'unsteady' | null;

/** Shared result shape for sustained and quick practice. */
export interface PracticeEvaluation {
  index: number;
  complete: boolean;
  phase: PracticePhase;
  state: PracticeState;
  /** Phase A: how long the correct pitch has been stable. */
  stableMs: number;
  cents: number | null;
  advanced: boolean;
  /** Phase B: elapsed hold time, required time, and the current 1-based beat (0 outside a hold). */
  holdMs: number;
  requiredMs: number;
  /** Written length of the current note in quarter-note beats (4 = whole, 2 = half). */
  beats: number;
  beat: number;
  faultMs: number;
  /** Set on the evaluation where a hold was abandoned. */
  reset: ResetReason;
}

/**
 * Two-phase whole-note practice.
 * Phase A (find): unlimited time; a stable in-tolerance pitch for `stableMs` starts the hold.
 * Phase B (hold): counts four beats at the selected tempo. See SUSTAIN in config.ts for the
 * fluctuation policy. After acceptance the next target requires a release (quiet) or a
 * confirmed pitch change, so one continuous sound cannot pass repeated identical notes.
 */
export class SustainEngine {
  index = 0;
  private phase: 'find' | 'hold' = 'find';
  private bpm: number;
  // Phase A
  private matchStart: number | null = null;
  private lastMatch: number | null = null;
  // Phase B
  private holdStart = 0;
  private lastGood = 0;
  private lastEval = 0;
  private faultMs = 0;
  // Release between notes
  private awaitingRelease = false;
  private releaseStart: number | null = null;
  private changeStart: number | null = null;

  constructor(readonly notes: PracticeNote[], bpm = DEFAULT_BPM, private settings: SustainSettings = SUSTAIN_SETTINGS) {
    this.bpm = clampTempo(bpm);
  }

  get tempo() { return this.bpm; }
  /** Beats of the current written note; whole notes when unspecified. */
  get beats() { return this.notes[Math.min(this.index, this.notes.length - 1)]?.beats ?? WHOLE_NOTE_BEATS; }
  get requiredMs() { return noteMs(this.beats, this.bpm); }
  /**
   * Total fault time tolerated in one hold: a fraction of the note, but never less than
   * one full grace period, so a single brief interruption is always allowed even in
   * short notes (a half note at 120 BPM lasts only 1 s).
   */
  get faultBudgetMs() { return Math.max(this.settings.maxFaultFraction * this.requiredMs, this.settings.holdGraceMs); }

  /** Tempo changes restart the current note's count so a note is never timed at two tempos. */
  setTempo(bpm: number) {
    const next = clampTempo(bpm);
    if (next === this.bpm) return;
    this.bpm = next;
    this.restartNote();
  }

  /** Return the current note to Phase A. Completed notes are kept. */
  restartNote() {
    this.phase = 'find';
    this.clearMatch();
    this.faultMs = 0;
  }

  /**
   * Discard all in-progress evidence (used while the reference tone plays). The next
   * note still needs fresh release evidence, and the current one needs a fresh find.
   */
  interrupt() {
    this.restartNote();
    this.releaseStart = null;
    this.changeStart = null;
  }

  evaluate(reading: PitchReading, now: number): PracticeEvaluation {
    if (this.index >= this.notes.length) return this.result('complete', null, false);
    const hz = reading.reason === 'ok' ? reading.smoothHz : null;
    const target = this.notes[this.index];
    const cents = hz ? centsFromTarget(hz, target.frequency) : null;

    if (this.awaitingRelease) {
      if (reading.reason === 'quiet') {
        this.releaseStart ??= now;
        if (now - this.releaseStart >= this.settings.releaseMs) this.awaitingRelease = false;
      } else {
        this.releaseStart = null;
        if (hz && !matchesTarget(hz, this.notes[this.index - 1].frequency, this.settings.toleranceCents)) {
          this.changeStart ??= now;
          if (now - this.changeStart >= this.settings.transitionMs) this.awaitingRelease = false;
        } else this.changeStart = null;
      }
      if (this.awaitingRelease) return this.result('release', cents, false);
    }

    if (this.phase === 'hold') return this.hold(reading, hz, cents, now);

    // Phase A — identical rules to quick recognition.
    if (!hz) {
      if (reading.reason === 'quiet' || this.lastMatch === null || now - this.lastMatch > this.settings.maxGapMs) this.clearMatch();
      return this.result(reading.reason === 'quiet' ? 'quiet' : reading.reason === 'outlier' ? 'outlier' : 'uncertain', null, false);
    }
    if (!matchesTarget(hz, target.frequency, this.settings.toleranceCents)) {
      this.clearMatch();
      return this.result('wrong', cents, false);
    }
    if (this.lastMatch === null || now - this.lastMatch > this.settings.maxGapMs) this.matchStart = now;
    this.lastMatch = now;
    if (now - this.matchStart! < this.settings.stableMs) return this.result('matching', cents, false, now);
    // Stable: begin counting the written duration from this moment.
    this.phase = 'hold';
    this.holdStart = now; this.lastGood = now; this.lastEval = now; this.faultMs = 0;
    this.clearMatch();
    return this.result('holding', cents, false, now);
  }

  private hold(reading: PitchReading, hz: number | null, cents: number | null, now: number): PracticeEvaluation {
    const good = hz !== null && cents !== null && Math.abs(cents) <= this.settings.holdToleranceCents;
    // Measure the gap since the last verified good reading BEFORE accepting this one,
    // so a long microphone interruption cannot be bridged by one fresh frame.
    const gap = now - this.lastGood;
    const dt = Math.max(0, now - this.lastEval);
    this.lastEval = now;
    if (gap > this.settings.holdGraceMs) return this.abandon('lost', reading, cents);
    if (good) this.lastGood = now; else this.faultMs += dt;
    if (this.faultMs > this.faultBudgetMs) return this.abandon('unsteady', reading, cents);
    const holdMs = now - this.holdStart;
    const beats = this.beats;
    if (good && holdMs >= this.requiredMs) {
      this.index++;
      this.phase = 'find';
      this.clearMatch();
      this.awaitingRelease = this.index < this.notes.length;
      this.releaseStart = null; this.changeStart = null;
      const done = this.index >= this.notes.length;
      return { ...this.base(done ? 'complete' : 'release', cents, true), holdMs, beat: beats, beats, faultMs: this.faultMs };
    }
    return { ...this.base(good ? 'holding' : 'wavering', cents, false), phase: 'hold', holdMs, beat: beatPosition(holdMs, this.bpm, beats).beat, faultMs: this.faultMs };
  }

  private abandon(reason: Exclude<ResetReason, null>, reading: PitchReading, cents: number | null): PracticeEvaluation {
    const faultMs = this.faultMs;
    this.restartNote();
    const state: PracticeState = reading.reason === 'quiet' ? 'quiet' : cents !== null ? 'wrong' : 'uncertain';
    return { ...this.base(state, cents, false), faultMs, reset: reason };
  }

  private clearMatch() { this.matchStart = null; this.lastMatch = null; }

  private base(state: PracticeState, cents: number | null, advanced: boolean): PracticeEvaluation {
    const complete = this.index >= this.notes.length;
    const phase: PracticePhase = complete ? 'complete' : this.awaitingRelease ? 'release' : this.phase;
    return { index: this.index, complete, phase, state, stableMs: 0, cents, advanced, holdMs: 0, requiredMs: this.requiredMs, beats: this.beats, beat: 0, faultMs: 0, reset: null };
  }

  private result(state: PracticeState, cents: number | null, advanced: boolean, now?: number): PracticeEvaluation {
    const evaluation = this.base(state, cents, advanced);
    if (state === 'matching' && now !== undefined && this.matchStart !== null) evaluation.stableMs = now - this.matchStart;
    if (state === 'holding') evaluation.beat = 1;
    return evaluation;
  }
}
