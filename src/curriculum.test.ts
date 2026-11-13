import { describe, expect, it } from 'vitest';
import { PRACTICE } from './config';
import { describeFingering, EXERCISES, findExercise, fingeringLabel, focusedExercise, parseNote, practiceNotes, validateExercise, type Exercise } from './curriculum';
import { OPEN_STRINGS } from './music';
import { MAX_A4, MIN_A4 } from './reference';

const names = (id: string) => practiceNotes(findExercise(id)!).map(note => note.name);
const durations = (id: string) => practiceNotes(findExercise(id)!).map(note => note.duration).join('');

describe('exercise library', () => {
  it('contains the Milestone 2B curriculum in order with unique stable ids', () => {
    expect(EXERCISES.map(e => `${e.number} ${e.title}`)).toEqual([
      '01 Open Strings', '02 String Crossings', '03 First Finger', '04 D-String Walk', '05 A-String Walk',
      '06 D Major Scale', '07 G Major Scale', '08A Morning Steps', '08B A-String Song', '08C Two-String Tune',
    ]);
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
  });

  it('every exercise validates: 4/4 measures, detector range, consistent fingering', () => {
    for (const exercise of EXERCISES) expect(validateExercise(exercise)).toEqual([]);
  });

  it('every written note stays within 160–800 Hz across the supported A4 range', () => {
    for (const exercise of EXERCISES) for (const a4 of [MIN_A4, 440, MAX_A4]) for (const note of practiceNotes(exercise, a4)) {
      expect(note.frequency).toBeGreaterThan(PRACTICE.minFrequency);
      expect(note.frequency).toBeLessThan(PRACTICE.maxFrequency);
    }
  });

  it('rejects malformed exercises', () => {
    const base = findExercise('d-major-scale')!;
    const broken: Exercise = { ...base, id: 'Bad Id', tempo: 200, measures: [[parseNote('D4:h@D0')], [parseNote('C4:w@D1')], [parseNote('F4:w@D2^')]] };
    const problems = validateExercise(broken).join('\n');
    expect(problems).toMatch(/lowercase slug/);
    expect(problems).toMatch(/tempo 200/);
    expect(problems).toMatch(/measure 1 has 2 beats/);
    expect(problems).toMatch(/C4 is not finger 1 on the D string/);
    expect(problems).toMatch(/F4 high-2 marking is inconsistent/);
    const low: Exercise = { ...base, measures: [[parseNote('E3:w')]] };
    expect(validateExercise(low).join()).toMatch(/E3 at A4=415 is outside the detector range/);
    expect(() => parseNote('H4:q')).toThrow(/Invalid note token/);
  });

  it('01 preserves the G3–D4–A4–E5 whole-note exercise and its frequencies', () => {
    const notes = practiceNotes(findExercise('open-strings')!);
    expect(notes.map(n => n.name)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(notes.map(n => n.beats)).toEqual([4, 4, 4, 4]);
    notes.forEach((note, i) => expect(note.frequency).toBeCloseTo(OPEN_STRINGS[i].frequency, 6));
    expect(practiceNotes(focusedExercise(findExercise('open-strings')!, 'A4')).map(n => `${n.name}${n.duration}`)).toEqual(['A4w', 'A4w', 'A4w', 'A4w']);
  });

  it('02–05 contain the specified notes and fingerings', () => {
    expect(new Set(names('string-crossings'))).toEqual(new Set(['G3', 'D4', 'A4', 'E5']));
    expect(names('first-finger')).toEqual(['D4', 'E4', 'E4', 'D4', 'D4', 'E4', 'D4', 'A4', 'B4', 'B4', 'A4', 'A4', 'B4', 'A4']);
    expect(names('d-string-walk')).toEqual(['D4', 'E4', 'F♯4', 'G4', 'F♯4', 'E4', 'D4']);
    expect(names('a-string-walk')).toEqual(['A4', 'B4', 'C♯5', 'D5', 'C♯5', 'B4', 'A4']);
    const walk = practiceNotes(findExercise('d-string-walk')!).slice(0, 4).map(n => fingeringLabel(n.fingering!));
    expect(walk).toEqual(['D0', 'D1', 'D↑2', 'D3']);
    expect(practiceNotes(findExercise('a-string-walk')!).slice(0, 4).map(n => n.fingering!.finger)).toEqual([0, 1, 2, 3]);
    expect(describeFingering({ string: 'D', finger: 2, high: true })).toBe('D string · 2nd finger (high)');
    expect(describeFingering({ string: 'G', finger: 0 })).toBe('G string · open');
  });

  it('06 D major: two sharps, ascending then descending, half notes ending on a whole note at 80 BPM', () => {
    const scale = findExercise('d-major-scale')!;
    expect(scale.keySignature).toBe('D');
    expect(scale.tempo).toBe(80);
    expect(names('d-major-scale')).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C♯5', 'D5', 'C♯5', 'B4', 'A4', 'G4', 'F♯4', 'E4', 'D4']);
    expect(durations('d-major-scale')).toBe('hhhhhhhhhhhhhhw');
    // The key signature supplies F♯ and C♯: no printed accidentals.
    expect(practiceNotes(scale).every(n => n.accidental === null)).toBe(true);
  });

  it('07 G major: one sharp, ascending then descending from G3', () => {
    const scale = findExercise('g-major-scale')!;
    expect(scale.keySignature).toBe('G');
    expect(scale.tempo).toBe(80);
    expect(names('g-major-scale')).toEqual(['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F♯4', 'G4', 'F♯4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3']);
    expect(durations('g-major-scale')).toBe('hhhhhhhhhhhhhhw');
    expect(practiceNotes(scale).every(n => n.accidental === null)).toBe(true);
  });

  it('prints accidentals for F♯ and C♯ where there is no key signature (04, 05)', () => {
    const marks = practiceNotes(findExercise('d-string-walk')!).map(n => n.accidental);
    expect(marks).toEqual([null, null, '#', null, '#', null, null]); // F♯ in two different measures
    expect(practiceNotes(findExercise('a-string-walk')!).filter(n => n.accidental === '#').map(n => n.name)).toEqual(['C♯5', 'C♯5']);
  });

  it('08 melodies are short, use learned notes, and place multiple notes per measure', () => {
    const learned = new Set(EXERCISES.slice(0, 7).flatMap(e => practiceNotes(e).map(n => n.name)));
    for (const id of ['melody-morning-steps', 'melody-a-string-song', 'melody-two-strings']) {
      const exercise = findExercise(id)!;
      expect(exercise.measures).toHaveLength(8);
      expect(exercise.measures.some(m => m.length === 2)).toBe(true);
      for (const name of names(id)) expect(learned.has(name)).toBe(true);
    }
  });

  it('flattens measures into ordered notes with measure numbers and beats', () => {
    const notes = practiceNotes(findExercise('d-major-scale')!);
    expect(notes.map(n => n.measure)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
    expect(notes.reduce((sum, n) => sum + n.beats!, 0)).toBe(32);
    expect(new Set(notes.map(n => n.id)).size).toBe(notes.length);
  });

  it('fingering hints default on for early exercises and off for scales and melodies', () => {
    expect(EXERCISES.filter(e => e.fingeringByDefault).map(e => e.number)).toEqual(['01', '02', '03', '04', '05']);
  });
});
