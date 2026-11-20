import { describe, expect, it } from 'vitest';
import { findExercise, practiceNotes } from './curriculum';
import { alternateSecondFinger } from './second-finger-guidance';

describe('alternate second-finger guidance', () => {
  for (const [id, heard, targetName] of [
    ['d-string-walk', 'F natural', 'F♯'],
    ['a-string-walk', 'C natural', 'C♯'],
  ] as const) {
    it(`${id} recognizes the low second finger on either side of the old cutoff`, () => {
      for (const a4 of [415, 440, 442, 466]) {
        const target = practiceNotes(findExercise(id)!, a4).find(note => note.fingering?.finger === 2)!;
        for (const cents of [-99, -101]) {
          const result = alternateSecondFinger(target, target.frequency * 2 ** (cents / 1200), a4);
          expect(result?.heard).toBe(heard);
          expect(result?.advice).toBe(`Hearing ${heard}. For ${targetName}, place your second finger close to your third.`);
        }
        expect(alternateSecondFinger(target, target.frequency, a4)).toBeNull();
        expect(alternateSecondFinger(target, null, a4)).toBeNull();
        expect(alternateSecondFinger(target, target.frequency / 2, a4)).toBeNull();
      }
    });
  }
  it('does not infer an alternate finger when the target has no second-finger suggestion', () => {
    const first = practiceNotes(findExercise('d-string-walk')!)[1];
    expect(alternateSecondFinger(first, first.frequency * 2 ** (-1 / 12), 440)).toBeNull();
  });
});
