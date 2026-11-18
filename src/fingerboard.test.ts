import { describe, expect, it } from 'vitest';
import { asPracticeNote, distanceFromNut, position, positionHz, POSITIONS, ROWS, shuffled, staffSequence, STRINGS, supported, walk } from './fingerboard';
import { frequencyToNote } from './music';
import { frequencyOf } from './notation';
import { PracticeSession } from './practice-session';
import type { PitchReading } from './pitch';

const ok = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: .99, rms: .1, note: frequencyToNote(hz), reason: 'ok' });
const quiet: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };
describe('fingerboard positions', () => {
  it('maps stopped notes to proportional distances from each string’s nut', () => {
    for (const string of STRINGS) {
      const distances = ROWS.map(row => distanceFromNut(position(string, row)));
      [0, 2, 3, 4, 5, 7].forEach((steps, index) => {
        expect(distances[index]).toBeCloseTo(1 - 2 ** (-steps / 12), 10);
      });
      const [, one, low, high, three, four] = distances;
      expect(high - one).toBeGreaterThan(2 * (three - high));
      expect(three - low).toBeGreaterThan(1.8 * (low - one));
      expect(four - three).toBeLessThan(high - one);
    }
  });
  it('keeps all 24 string/position identities and exact written spellings', () => {
    expect(POSITIONS).toHaveLength(24);
    expect(['G', 'D', 'A', 'E'].map(s => POSITIONS.filter(p => p.string === s).map(p => asPracticeNote(p).name))).toEqual([
      ['G3', 'A3', 'B♭3', 'B3', 'C4', 'D4'],
      ['D4', 'E4', 'F4', 'F♯4', 'G4', 'A4'],
      ['A4', 'B4', 'C5', 'C♯5', 'D5', 'E5'],
      ['E5', 'F♯5', 'G5', 'G♯5', 'A5', 'B5'],
    ]);
    expect(position('D', 'four').id).not.toBe(position('A', 'open').id);
    expect(positionHz(position('D', 'four'))).toBeCloseTo(positionHz(position('A', 'open')));
    expect(positionHz(position('G', 'low2'))).toBeCloseTo(frequencyOf({ step: 'A', accidental: '#', octave: 3 }));
    expect(positionHz(position('D', 'high2')) / positionHz(position('D', 'low2'))).toBeCloseTo(2 ** (1 / 12));
  });
  it('uses the A4 reference and marks unsupported high notes without changing the detector', () => {
    for (const a4 of [415, 432, 440, 442, 466]) {
      expect(positionHz(position('A', 'open'), a4)).toBe(a4);
      expect(supported(position('A', 'three'), a4)).toBe(true);
      expect(supported(position('E', 'four'), a4)).toBe(false);
    }
    expect(supported(position('E', 'low2'), 440)).toBe(true);
    expect(supported(position('E', 'low2'), 466)).toBe(false);
  });
  it('walks one second-finger placement at a time and descends without a repeated summit', () => {
    expect(walk('D', 'high2').map(p => asPracticeNote(p).name)).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'G4', 'F♯4', 'E4', 'D4']);
    expect(walk('D', 'low2').map(p => asPracticeNote(p).name)).toEqual(['D4', 'E4', 'F4', 'G4', 'A4', 'G4', 'F4', 'E4', 'D4']);
    expect(walk('A', 'low2').map(p => asPracticeNote(p).name)).toContain('C5');
    expect(walk('G', 'low2').map(p => asPracticeNote(p).name)).toContain('B♭3');
  });
  it('shuffles reproducibly without repeating the preceding cycle target', () => {
    const pool = walk('D', 'high2').slice(0, 5);
    expect(shuffled(pool, 12).map(p => p.id)).toEqual(shuffled(pool, 12).map(p => p.id));
    expect(new Set(shuffled(pool, 12).map(p => p.id)).size).toBe(5);
    const first = shuffled(pool, 12)[0].id;
    expect(shuffled(pool, 12, first)[0].id).not.toBe(first);
  });
  it('builds a staff sequence from familiar D and A positions', () => {
    const sequence = staffSequence();
    expect(sequence.map(p => asPracticeNote(p).name)).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C♯5', 'D5']);
    expect(sequence.every(p => supported(p, 466))).toBe(true);
    expect(sequence.map((p, i) => asPracticeNote(p, 440, i).measure)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('trainer engine reuse', () => {
  it('requires stable matching observations and ignores a wrong note', () => {
    const notes = walk('D', 'high2').map((p, i) => asPracticeNote(p, 440, i));
    const session = new PracticeSession(notes, 'quick');
    expect(session.evaluate(ok(notes[1].frequency), 0).state).toBe('wrong');
    expect(session.evaluate(ok(notes[0].frequency), 50).index).toBe(0);
    for (const time of [100, 150, 200, 250, 300, 350]) session.evaluate(ok(notes[0].frequency), time);
    expect(session.evaluate(ok(notes[0].frequency), 400).index).toBe(1);
  });
  it('requires credible release for repeated written pitch at distinct positions', () => {
    const notes = [position('D', 'four'), position('A', 'open')].map((p, i) => asPracticeNote(p, 440, i));
    const session = new PracticeSession(notes, 'quick');
    session.evaluate(ok(440), 0);
    for (const time of [50, 100, 150, 200, 250, 300]) session.evaluate(ok(440), time);
    expect(session.evaluate(ok(440), 350).index).toBe(1);
    for (const time of [400, 450, 500, 550, 600]) expect(session.evaluate(ok(440), time).index).toBe(1);
    expect(session.evaluate(quiet, 650).state).toBe('release');
    expect(session.evaluate(ok(440), 700).state).toBe('release');
    session.evaluate(quiet, 800);
    session.evaluate(quiet, 1000);
    session.evaluate(ok(440), 1050);
    for (const time of [1100, 1150, 1200, 1250, 1300, 1350]) session.evaluate(ok(440), time);
    expect(session.evaluate(ok(440), 1400).complete).toBe(true);
  });
  it('suppresses the entire reference window and needs fresh evidence afterward', () => {
    const note = asPracticeNote(position('D', 'open'));
    const session = new PracticeSession([note], 'quick');
    session.suppress(2100);
    for (const time of [0, 350, 1200, 1800, 2050]) expect(session.evaluate(ok(note.frequency), time).advanced).toBe(false);
    expect(session.evaluate(ok(note.frequency), 2150).advanced).toBe(false);
    for (const time of [2200, 2250, 2300, 2350, 2400, 2450]) session.evaluate(ok(note.frequency), time);
    expect(session.evaluate(ok(note.frequency), 2500).advanced).toBe(true);
  });
});
