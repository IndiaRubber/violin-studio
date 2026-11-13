// Musical timing for practice exercises. Pure functions with no clock or DOM access,
// so they can be tested deterministically and shared by the engine and the UI.

export const MIN_BPM = 40;
export const MAX_BPM = 120;
export const DEFAULT_BPM = 60;
export const TEMPO_STEP = 5;
/** Beats per measure in 4/4 time; the quarter note receives one beat. */
export const BEATS_PER_MEASURE = 4;
/** A whole note lasts four quarter-note beats in 4/4. */
export const WHOLE_NOTE_BEATS = 4;

export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Length of one quarter-note beat in milliseconds. */
export function beatMs(bpm: number): number {
  return 60_000 / clampTempo(bpm);
}

/** Whole-note duration: 240 / BPM seconds (four quarter-note beats). */
export function wholeNoteMs(bpm: number): number {
  return WHOLE_NOTE_BEATS * beatMs(bpm);
}

export interface BeatPosition {
  /** 1-based beat currently sounding, or 0 before the hold starts. */
  beat: number;
  /** Fraction of the whole note completed, clamped to 0–1. */
  progress: number;
}

/** Where a hold of `elapsedMs` sits inside a whole note at `bpm`. */
export function beatPosition(elapsedMs: number, bpm: number, beats = WHOLE_NOTE_BEATS): BeatPosition {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { beat: 0, progress: 0 };
  const total = beats * beatMs(bpm);
  const progress = Math.min(1, elapsedMs / total);
  const beat = Math.min(beats, Math.floor(elapsedMs / beatMs(bpm)) + 1);
  return { beat, progress };
}
