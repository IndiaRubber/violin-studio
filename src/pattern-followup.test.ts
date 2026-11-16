import { describe, expect, it } from 'vitest';
import { EXERCISES, findExercise, fingeringLabel, practiceNotes } from './curriculum';
import { ExerciseEngine } from './exercise';
import { centsFromTarget } from './music';
import { activePattern, demoFrequencies, patternVisible } from './pattern';
import type { PitchReading } from './pitch';
import { PracticeSession } from './practice-session';
import { patternDemoMs } from './pattern-demo';

const lesson = (id: string, a4 = 440) => practiceNotes(findExercise(id)!, a4);
const tone = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.99, rms: 0.1, note: null, reason: 'ok' });
const quiet: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };

describe('05D–05H finger-pattern lessons', () => {
  it('keeps eight lessons between the walks and scales with complete 4/4 measures', () => {
    expect(EXERCISES.slice(5, 13).map(e => e.number)).toEqual(['05A', '05B', '05C', '05D', '05E', '05F', '05G', '05H']);
    for (const exercise of EXERCISES.slice(8, 13)) {
      expect(exercise.measures.every(bar => bar.reduce((beats, n) => beats + (n.duration === 'h' ? 2 : 4), 0) === 4)).toBe(true);
      expect(exercise.patterns?.every(group => demoFrequencies(practiceNotes(exercise), group).length > 0)).toBe(true);
    }
  });

  it('05D contrasts C♯ and courtesy-natural C while B and D stay fixed on A', () => {
    const notes = lesson('pattern-low-second-a');
    expect(notes.map(n => n.name)).toEqual(['B4', 'C♯5', 'D5', 'C♯5', 'B4', 'B4', 'C5', 'D5', 'C5', 'B4']);
    expect(notes.map(n => fingeringLabel(n.fingering!))).toEqual(['A1', 'A↑2', 'A3', 'A↑2', 'A1', 'A1', 'A2', 'A3', 'A2', 'A1']);
    expect(notes.map(n => n.accidental)).toEqual([null, '#', null, '#', null, null, 'n', null, 'n', null]);
    expect(centsFromTarget(notes[1].frequency, notes[6].frequency)).toBeCloseTo(100, 5);
    expect(notes[0].frequency).toBe(notes[5].frequency);
    expect(notes[2].frequency).toBe(notes[7].frequency);
    expect(findExercise('pattern-low-second-a')!.patterns?.map(g => g.closePair)).toEqual(['2–3', '1–2']);
  });

  it('05E suggests fourth-finger A on D and open A as consecutive identical pitches', () => {
    const notes = lesson('pattern-fourth-finger');
    expect(notes.map(n => n.name)).toEqual(['E4', 'F♯4', 'G4', 'A4', 'A4', 'G4']);
    expect(notes.map(n => fingeringLabel(n.fingering!))).toEqual(['D1', 'D↑2', 'D3', 'D4', 'A0', 'D3']);
    for (const a4 of [415, 432, 440, 442, 466]) {
      const pair = lesson('pattern-fourth-finger', a4);
      expect(pair[3].frequency).toBe(a4);
      expect(pair[4].frequency).toBe(a4);
    }
    const engine = new ExerciseEngine(notes.slice(3, 5));
    for (let t = 0; t <= 350; t += 50) engine.evaluate(tone(notes[3].frequency), t);
    expect(engine.index).toBe(1);
    for (let t = 400; t <= 800; t += 50) expect(engine.evaluate(tone(notes[4].frequency), t).state).toBe('release');
    engine.evaluate(quiet, 850); engine.evaluate(quiet, 1050);
    for (let t = 1100; t <= 1450; t += 50) engine.evaluate(tone(notes[4].frequency), t);
    expect(engine.index).toBe(2);
  });

  it('05F changes the close pair at the G-major crossing and links to the unchanged G scale', () => {
    const exercise = findExercise('pattern-crossing-change')!;
    const notes = lesson(exercise.id);
    expect(exercise.keySignature).toBe('G');
    expect(notes.map(n => n.name)).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C5', 'D5']);
    expect(notes.map(n => fingeringLabel(n.fingering!))).toEqual(['D0', 'D1', 'D↑2', 'D3', 'A0', 'A1', 'A2', 'A3']);
    expect(notes.map(n => n.accidental)).toEqual([null, null, null, null, null, null, 'n', null]);
    expect(activePattern(exercise, 3)?.closePair).toBe('2–3');
    expect(activePattern(exercise, 4)?.closePair).toBe('1–2');
    expect(exercise.patterns![0].cue).toContain('Coming next on A');
    expect(lesson('g-major-scale').map(n => n.name)).toEqual(['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F♯4', 'G4', 'F♯4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3']);
  });

  it('05G puts familiar high and low shapes out of scale order with an optional cue', () => {
    const exercise = findExercise('pattern-out-of-order')!;
    expect(lesson(exercise.id).map(n => n.name)).toEqual(['G4', 'E4', 'F♯4', 'G4', 'D5', 'B4', 'C5', 'B4']);
    expect(lesson(exercise.id).map(n => fingeringLabel(n.fingering!))).toEqual(['D3', 'D1', 'D↑2', 'D3', 'A3', 'A1', 'A2', 'A1']);
    expect(lesson(exercise.id).map(n => n.accidental)).toEqual([null, null, null, null, null, null, 'n', null]);
    expect(patternVisible(exercise, undefined, false)).toBe(false);
    expect(patternVisible(exercise, true, false)).toBe(true);
  });

  it('05H is an original four-bar G-major challenge with two concealed shapes', () => {
    const exercise = findExercise('pattern-spot-change')!;
    expect(exercise.measures).toHaveLength(4);
    expect(exercise.keySignature).toBe('G');
    expect(lesson(exercise.id).map(n => n.name)).toEqual(['E4', 'F♯4', 'G4', 'E4', 'B4', 'C5', 'D5', 'B4']);
    expect(exercise.patterns?.map(g => [g.start, g.end, g.closePair])).toEqual([[0, 4, '2–3'], [4, 8, '1–2']]);
    expect(exercise.patternChallenge).toBe(true);
    expect(exercise.fingeringByDefault).toBe(false);
    expect(patternVisible(exercise, true, false)).toBe(false);
    expect(patternVisible(exercise, undefined, true)).toBe(true);
    expect(patternVisible(exercise, undefined, true, true)).toBe(false);
    expect(exercise.objective).not.toMatch(/fingers 1|fingers 2|half step/);
    expect(exercise.patternQuestion).not.toMatch(/fingers 1|fingers 2|half step/);
  });

  it('suppresses matching evidence throughout a four-note group and settles before resuming', () => {
    const exercise = findExercise('pattern-crossing-change')!;
    const session = new PracticeSession(lesson(exercise.id), 'quick');
    const end = patternDemoMs(exercise.patterns![0].demo.length);
    session.suppress(end);
    for (let t = 0; t < end; t += 50) {
      const result = session.evaluate(tone(session.notes[0].frequency), t);
      expect(result.advanced).toBe(false);
      expect(result.state).toBe('reference');
    }
    expect(session.index).toBe(0);
    expect(session.evaluate(tone(session.notes[0].frequency), end + 50).advanced).toBe(false);
  });
});
