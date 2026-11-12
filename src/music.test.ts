import { describe, expect, it } from 'vitest';
import { centsFromTarget, frequencyToNote, matchesTarget } from './music';

describe('musical pitch', () => {
  it('names all open strings with the correct octave', () => {
    expect([196, 293.66, 440, 659.26].map(frequencyToNote)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(frequencyToNote(880)).toBe('A5');
    expect(frequencyToNote(0)).toBeNull();
  });
  it('reports signed cents relative to the target', () => {
    expect(centsFromTarget(440 * 2 ** (20 / 1200), 440)).toBeCloseTo(20, 5);
    expect(centsFromTarget(440 * 2 ** (-20 / 1200), 440)).toBeCloseTo(-20, 5);
  });
  it('uses configurable tolerance and rejects octave errors', () => {
    expect(matchesTarget(440 * 2 ** (24 / 1200), 440, 25)).toBe(true);
    expect(matchesTarget(440 * 2 ** (26 / 1200), 440, 25)).toBe(false);
    expect(matchesTarget(880, 440, 25)).toBe(false);
  });
});
