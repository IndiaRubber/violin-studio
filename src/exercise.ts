import { PRACTICE } from './config';
import { centsFromTarget, matchesTarget, type PracticeNote } from './music';
import type { PitchReading } from './pitch';

export interface Evaluation { index: number; complete: boolean; state: 'quiet' | 'uncertain' | 'outlier' | 'wrong' | 'matching' | 'release' | 'complete'; stableMs: number; cents: number | null; advanced: boolean; }
export interface ExerciseSettings { toleranceCents: number; stableMs: number; maxGapMs: number; releaseMs: number; transitionMs: number; }
export class ExerciseEngine {
  index = 0;
  private matchStart: number | null = null;
  private lastMatch: number | null = null;
  private releaseStart: number | null = null;
  private changeStart: number | null = null;
  private awaitingRelease = false;
  constructor(readonly notes: PracticeNote[], private settings: ExerciseSettings = PRACTICE) {}
  evaluate(reading: PitchReading, now: number): Evaluation {
    if (this.index >= this.notes.length) return this.result('complete', 0, null, false);
    const hz = reading.reason === 'ok' ? reading.smoothHz : null;
    const cents = hz ? centsFromTarget(hz, this.notes[this.index].frequency) : null;
    if (this.awaitingRelease) {
      // The next target needs a new bow event. A brief signal dropout is insufficient.
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
      if (this.awaitingRelease) return this.result('release', 0, cents, false);
    }
    if (!hz) {
      if (reading.reason === 'quiet' || this.lastMatch === null || now - this.lastMatch > this.settings.maxGapMs) this.clearMatch();
      return this.result(reading.reason === 'quiet' ? 'quiet' : reading.reason === 'outlier' ? 'outlier' : 'uncertain', this.matchStart === null ? 0 : now - this.matchStart, null, false);
    }
    if (!matchesTarget(hz, this.notes[this.index].frequency, this.settings.toleranceCents)) {
      this.clearMatch();
      return this.result('wrong', 0, cents, false);
    }
    if (this.lastMatch === null || now - this.lastMatch > this.settings.maxGapMs) this.matchStart = now;
    this.lastMatch = now;
    const stableMs = now - this.matchStart!;
    if (stableMs < this.settings.stableMs) return this.result('matching', stableMs, cents, false);
    this.index++;
    this.clearMatch();
    this.awaitingRelease = this.index < this.notes.length;
    this.releaseStart = null;
    this.changeStart = null;
    return this.result(this.index === this.notes.length ? 'complete' : 'release', stableMs, cents, true);
  }
  private clearMatch() { this.matchStart = null; this.lastMatch = null; }
  private result(state: Evaluation['state'], stableMs: number, cents: number | null, advanced: boolean): Evaluation {
    return { index: this.index, complete: this.index >= this.notes.length, state, stableMs, cents, advanced };
  }
}
