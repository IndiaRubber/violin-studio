import { DURATION_BEATS, type Duration } from './notation';
import { BEATS_PER_MEASURE } from './tempo';

export const TRACK_BEAT_PX = 28;
export const TRACK_MEASURE_PX = TRACK_BEAT_PX * BEATS_PER_MEASURE;
export const TRACK_BAR_INSET = 16;
export const TRACK_PLAYHEAD_X = 42;
const HOLD_END_GAP = 8;

/** A score's horizontal positions are based on beats, never viewport width or current note. */
export function scoreTrack(notes: readonly { measure?: number; duration?: Duration }[]) {
  const measures: number[][] = [];
  notes.forEach((note, index) => { (measures[note.measure ?? index] ??= []).push(index); });
  const grouped = measures.filter(Boolean);
  const slots: { x: number; holdEnd: number; measure: number }[] = [];
  grouped.forEach((indices, measure) => {
    let elapsed = measure * BEATS_PER_MEASURE;
    for (const index of indices) {
      const x = TRACK_PLAYHEAD_X + elapsed * TRACK_BEAT_PX;
      const beats = DURATION_BEATS[notes[index].duration ?? 'w'];
      slots[index] = { x, holdEnd: x + beats * TRACK_BEAT_PX - HOLD_END_GAP, measure };
      elapsed += beats;
    }
  });
  return { measures: grouped, slots, width: TRACK_PLAYHEAD_X + grouped.length * TRACK_MEASURE_PX };
}

/** Move to the same playhead for every note, even if only the last note is left. */
export function trackOffset(noteX: number | undefined) {
  return Math.max(0, (noteX ?? TRACK_PLAYHEAD_X) - TRACK_PLAYHEAD_X);
}

export function inspectWindow(count: number, viewport: number, start: number) {
  const length = Math.max(1, Math.floor(viewport / TRACK_MEASURE_PX));
  const first = Math.min(Math.max(0, start), Math.max(0, count - 1));
  return { first, last: Math.min(count - 1, first + length - 1), length };
}
