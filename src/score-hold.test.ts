import { describe, expect, it } from 'vitest';
import { initialPracticeEvaluation } from './practice-session';
import { holdSegments, pitchOffset, recordHoldSample } from './score-hold';
import type { PracticeEvaluation } from './sustain';

const hold = (ms: number, cents: number | null): PracticeEvaluation => ({
  ...initialPracticeEvaluation(), phase: 'hold', holdMs: ms, requiredMs: 2000, cents,
});

describe('score hold trace', () => {
  it('uses time held rather than frame count and keeps gaps in uncertain input', () => {
    let trail = recordHoldSample([], hold(0, 0));
    for (const point of [hold(200, 12), hold(450, null), hold(650, -14), hold(1000, 0)]) trail = recordHoldSample(trail, point);
    expect(holdSegments(trail)).toEqual([
      [{ progress: 0, cents: 0 }, { progress: .1, cents: 12 }],
      [{ progress: .325, cents: -14 }, { progress: .5, cents: 0 }],
    ]);
  });

  it('clears on a dropped hold, advance, or reference and never carries an old attempt', () => {
    const trail = recordHoldSample([], hold(850, 10));
    expect(recordHoldSample(trail, { ...hold(850, 10), phase: 'find', reset: 'lost' })).toEqual([]);
    expect(recordHoldSample(trail, { ...hold(850, 10), phase: 'release', advanced: true })).toEqual([]);
    expect(recordHoldSample(trail, { ...hold(850, 10), phase: 'find', state: 'reference' })).toEqual([]);
    expect(recordHoldSample(trail, hold(0, -10))).toEqual([{ progress: 0, cents: -10 }]);
  });

  it('bends sharp up and flat down while clamping the trace to the score lane', () => {
    expect(pitchOffset(0)).toBeCloseTo(0);
    expect(pitchOffset(18)).toBeCloseTo(-4.2);
    expect(pitchOffset(-18)).toBeCloseTo(4.2);
    expect(pitchOffset(900)).toBe(-14);
    expect(pitchOffset(-900)).toBe(14);
  });
});
