import type { PracticeEvaluation } from './sustain';

export interface HoldSample { progress: number; cents: number | null }

/** A quiet/uncertain frame breaks the trace rather than drawing a false pitch. */
export function recordHoldSample(previous: HoldSample[], evaluation: PracticeEvaluation): HoldSample[] {
  if (evaluation.phase !== 'hold' || evaluation.reset || evaluation.requiredMs <= 0) return previous.length ? [] : previous;
  const progress = Math.min(1, Math.max(0, evaluation.holdMs / evaluation.requiredMs));
  const cents = evaluation.cents !== null && Number.isFinite(evaluation.cents) ? evaluation.cents : null;
  const last = previous.at(-1);
  const sample = { progress, cents };
  return !last || progress < last.progress ? [sample]
    : progress === last.progress ? [...previous.slice(0, -1), sample] : [...previous, sample];
}

export function holdSegments(samples: HoldSample[]): { progress: number; cents: number }[][] {
  const segments: { progress: number; cents: number }[][] = [];
  let current: { progress: number; cents: number }[] = [];
  for (const p of samples) {
    if (p.cents === null) { current = []; continue; }
    if (!current.length) segments.push(current);
    current.push({ progress: p.progress, cents: p.cents });
  }
  return segments;
}

export const pitchOffset = (cents: number) => -Math.max(-60, Math.min(60, cents)) / 60 * 14;
