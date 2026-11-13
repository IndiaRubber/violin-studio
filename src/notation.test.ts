import { describe, expect, it } from 'vitest';
import { accidentalsForMeasure, DURATION_BEATS, frequencyOf, midiOf, spell, vexKey, type WrittenPitch } from './notation';

const p = (step: WrittenPitch['step'], octave: number, accidental?: WrittenPitch['accidental']): WrittenPitch => ({ step, octave, ...(accidental ? { accidental } : {}) });

describe('written pitch', () => {
  it('derives MIDI numbers and octaves from spelling (C4 = 60, A4 = 69)', () => {
    expect(midiOf(p('C', 4))).toBe(60);
    expect(midiOf(p('A', 4))).toBe(69);
    expect(midiOf(p('G', 3))).toBe(55);
    expect(midiOf(p('B', 3))).toBe(59); // octave numbers change at C, not A
    expect(midiOf(p('C', 5, '#'))).toBe(73);
    expect(midiOf(p('E', 5))).toBe(76);
  });

  it('derives equal-tempered frequencies from note, octave, and A4 reference', () => {
    expect(frequencyOf(p('A', 4))).toBe(440);
    expect(frequencyOf(p('G', 3))).toBeCloseTo(196.0, 2);
    expect(frequencyOf(p('D', 4))).toBeCloseTo(293.66, 2);
    expect(frequencyOf(p('F', 4, '#'))).toBeCloseTo(369.99, 2);
    expect(frequencyOf(p('C', 5, '#'))).toBeCloseTo(554.37, 2);
    expect(frequencyOf(p('E', 5))).toBeCloseTo(659.26, 2);
    expect(frequencyOf(p('A', 4), 442)).toBe(442);
    expect(frequencyOf(p('D', 4), 442) / frequencyOf(p('D', 4))).toBeCloseTo(442 / 440, 10);
  });

  it('keeps enharmonic spellings distinct while sounding the same', () => {
    expect(spell(p('F', 4, '#'))).toBe('F♯4');
    expect(spell(p('G', 4, 'b'))).toBe('G♭4');
    expect(frequencyOf(p('F', 4, '#'))).toBeCloseTo(frequencyOf(p('G', 4, 'b')), 10);
    expect(midiOf(p('B', 3, '#'))).toBe(midiOf(p('C', 4)));
    expect(spell(p('B', 3, '#'))).toBe('B♯3');
    expect(spell(p('E', 4, 'n'))).toBe('E4');
  });

  it('produces VexFlow keys without printing accidentals implicitly', () => {
    expect(vexKey(p('F', 4, '#'))).toBe('f#/4');
    expect(vexKey(p('B', 3, 'b'))).toBe('bb/3');
    expect(vexKey(p('G', 3))).toBe('g/3');
  });

  it('uses 4 beats for whole notes and 2 for half notes', () => {
    expect(DURATION_BEATS).toEqual({ w: 4, h: 2 });
  });
});

describe('accidentals and key signatures', () => {
  it('omits sharps already in the key signature', () => {
    expect(accidentalsForMeasure([p('F', 4, '#'), p('C', 5, '#')], 'D')).toEqual([null, null]);
    expect(accidentalsForMeasure([p('F', 4, '#'), p('G', 4)], 'G')).toEqual([null, null]);
  });
  it('prints accidentals outside the key, once per measure, per octave', () => {
    expect(accidentalsForMeasure([p('F', 4, '#'), p('F', 4, '#')], 'C')).toEqual(['#', null]);
    expect(accidentalsForMeasure([p('F', 4, '#'), p('F', 5, '#')], 'C')).toEqual(['#', '#']);
    expect(accidentalsForMeasure([p('C', 5, '#'), p('D', 5)], 'C')).toEqual(['#', null]);
  });
  it('prints a natural to cancel the key signature or an earlier accidental', () => {
    expect(accidentalsForMeasure([p('F', 4)], 'D')).toEqual(['n']);
    expect(accidentalsForMeasure([p('F', 4, '#'), p('F', 4)], 'C')).toEqual(['#', 'n']);
    expect(accidentalsForMeasure([p('C', 5), p('C', 5, '#')], 'D')).toEqual(['n', '#']);
  });
});
