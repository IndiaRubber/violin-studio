import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXERCISES, findExercise, fingeringLabel, practiceNotes } from './curriculum';
import { centsFromTarget } from './music';
import { activePattern, demoFrequencies, patternVisible } from './pattern';
import { PATTERN_GAP_MS, PATTERN_TONE, PatternDemo, patternDemoMs } from './pattern-demo';
import { PracticeSession } from './practice-session';
import type { PitchReading } from './pitch';

const notes = (id: string, a4 = 440) => practiceNotes(findExercise(id)!, a4);
const tone = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.99, rms: 0.1, note: null, reason: 'ok' });

describe('finger-pattern curriculum', () => {
  it('compares the high and low second finger without moving E or G', () => {
    const exercise = findExercise('pattern-move-one-finger')!;
    expect(exercise.measures.map(bar => bar.reduce((sum, note) => sum + (note.duration === 'w' ? 4 : 2), 0))).toEqual([4, 4, 4, 4, 4, 4]);
    expect(notes(exercise.id).map(n => n.name)).toEqual(['E4', 'F♯4', 'G4', 'F♯4', 'E4', 'E4', 'F4', 'G4', 'F4', 'E4']);
    expect(notes(exercise.id).map(n => fingeringLabel(n.fingering!))).toEqual(['D1', 'D↑2', 'D3', 'D↑2', 'D1', 'D1', 'D2', 'D3', 'D2', 'D1']);
    expect(exercise.patterns?.map(g => g.closePair)).toEqual(['2–3', '1–2']);
    expect(activePattern(exercise, 4)?.title).toBe('High second finger');
    expect(activePattern(exercise, 5)?.title).toBe('Low second finger');
    const marks = notes(exercise.id).map(n => n.accidental);
    expect(marks).toEqual([null, '#', null, '#', null, null, 'n', null, 'n', null]);
    expect(notes(exercise.id)[6].vexKey).toBe('f/4');
    expect(notes(exercise.id)[1].vexKey).toBe('f#/4');
    expect(centsFromTarget(notes(exercise.id)[1].frequency, notes(exercise.id)[6].frequency)).toBeCloseTo(100, 5);
  });

  it('moves the same open–1–high 2–3 spacing from D to A and derives every pitch from A4', () => {
    const exercise = findExercise('pattern-move-shape')!;
    expect(notes(exercise.id).map(n => n.name)).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C♯5', 'D5']);
    expect(notes(exercise.id).map(n => fingeringLabel(n.fingering!))).toEqual(['D0', 'D1', 'D↑2', 'D3', 'A0', 'A1', 'A↑2', 'A3']);
    for (const a4 of [415, 432, 440, 442, 466]) {
      const pitches = notes(exercise.id, a4);
      expect(pitches[4].frequency).toBe(a4);
      for (let i = 0; i < 4; i++) expect(centsFromTarget(pitches[i + 4].frequency, pitches[i].frequency)).toBeCloseTo(700, 5);
      expect(demoFrequencies(pitches, exercise.patterns![1])).toEqual(pitches.slice(4, 8).map(n => n.frequency));
    }
    const scale = findExercise('d-major-scale')!;
    expect(scale.patterns?.map(g => [g.start, g.end, g.closePair])).toEqual([[0, 4, '2–3'], [4, 8, '2–3']]);
    expect(scale.patternHintsByDefault).toBe(false);
    expect(notes(scale.id).slice(0, 8).map(n => n.name)).toEqual(notes(exercise.id).map(n => n.name));
    expect(notes(scale.id).every(n => n.accidental === null)).toBe(true); // key signature, unchanged
  });

  it('reuses Morning Steps measures 2–4 and locates the close pair across bars 3–4', () => {
    const excerpt = findExercise('pattern-spot-phrase')!;
    const tune = findExercise('melody-morning-steps')!;
    expect(excerpt.measures).toEqual(tune.measures.slice(1, 4));
    expect(notes(excerpt.id).map(n => n.name)).toEqual(['F♯4', 'D4', 'E4', 'F♯4', 'G4']);
    expect(excerpt.patterns![0].demo).toEqual([2, 3, 4]);
    expect(excerpt.patterns![0].closePair).toBe('2–3');
    expect(patternVisible(excerpt, true, false)).toBe(false); // saved choice cannot leak answer
    expect(patternVisible(excerpt, undefined, true)).toBe(true);
    expect(patternVisible(excerpt, undefined, true, true)).toBe(false);
    expect(patternVisible(findExercise('d-major-scale')!, undefined, false)).toBe(false);
    expect(patternVisible(findExercise('d-major-scale')!, true, false)).toBe(true);
    expect(EXERCISES.slice(0, 5).every(e => !e.patterns)).toBe(true);
  });
});

describe('pattern demonstration and microphone suppression', () => {
  afterEach(() => vi.useRealTimers());
  it('plays sequential tones with gaps and stops without scheduling more notes after restart', async () => {
    vi.useFakeTimers();
    const ends: (() => void)[] = [];
    const player = { play: vi.fn(async (_hz: number, end?: () => void) => { ends.push(end!); return PATTERN_TONE.durationMs; }), stop: vi.fn(), dispose: vi.fn() };
    const demo = new PatternDemo(player);
    const done = vi.fn();
    demo.start([330, 370, 392], done, vi.fn());
    expect(player.play.mock.calls.map(call => call[0])).toEqual([330]);
    ends[0]();
    vi.advanceTimersByTime(PATTERN_GAP_MS - 1);
    expect(player.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(player.play.mock.calls.map(call => call[0])).toEqual([330, 370]);
    demo.stop();
    expect(player.dispose).toHaveBeenCalledTimes(2); // initial reset and cancelled pending playback
    ends[1]();
    vi.advanceTimersByTime(1000);
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(done).not.toHaveBeenCalled();
    expect(demo.playing).toBe(false);
    demo.dispose();
    expect(player.dispose).toHaveBeenCalledTimes(3);
  });

  it('suppresses all matching frames through tones, gaps and settling, then requires a fresh hold', () => {
    const exercise = findExercise('pattern-move-one-finger')!;
    const session = new PracticeSession(notes(exercise.id), 'quick');
    const hz = session.notes[0].frequency;
    const end = patternDemoMs(exercise.patterns![0].demo.length);
    session.suppress(end);
    for (let now = 50; now < end; now += 50) {
      const result = session.evaluate(tone(hz), now);
      expect(result.state).toBe('reference');
      expect(result.advanced).toBe(false);
    }
    expect(session.index).toBe(0);
    expect(session.evaluate(tone(hz), end + 50).advanced).toBe(false);
    let advanced = false;
    for (let now = end + 100; now <= end + 500; now += 50) advanced ||= session.evaluate(tone(hz), now).advanced;
    expect(session.index).toBe(1);
    expect(advanced).toBe(true);
  });
});
