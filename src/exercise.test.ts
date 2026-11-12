import { describe, expect, it } from 'vitest';
import { ExerciseEngine } from './exercise';
import { OPEN_STRINGS } from './music';
import type { PitchReading } from './pitch';

const tone = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.98, rms: 0.1, note: 'G3', reason: 'ok' });
const quiet: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };
const uncertain: PitchReading = { rawHz: 196, smoothHz: null, clarity: 0.3, rms: 0.1, note: null, reason: 'uncertain' };

describe('exercise progression', () => {
  it('bridges one uncertain or outlier frame but requires a fresh matching frame to advance', () => {
    const engine = new ExerciseEngine([OPEN_STRINGS[0]]);
    for (let t = 0; t <= 300; t += 50) engine.evaluate(tone(196), t);
    expect(engine.evaluate(uncertain, 350).advanced).toBe(false);
    const outlier: PitchReading = { ...uncertain, rawHz: 392, reason: 'outlier' };
    expect(engine.evaluate(outlier, 400).advanced).toBe(false);
    expect(engine.evaluate(tone(196), 450).advanced).toBe(false); // interruption exceeded 110 ms
    for (let t = 500; t < 800; t += 50) expect(engine.evaluate(tone(196), t).advanced).toBe(false);
    expect(engine.evaluate(tone(196), 800).advanced).toBe(true);
    expect(engine.evaluate(tone(196), 850).advanced).toBe(false);
  });
  it('tolerates one uncertain frame, then resets after several or after silence', () => {
    const engine = new ExerciseEngine([OPEN_STRINGS[0]]);
    engine.evaluate(tone(196), 0); engine.evaluate(tone(196), 50);
    engine.evaluate(uncertain, 100);
    expect(engine.evaluate(tone(196), 150).stableMs).toBe(150);
    engine.evaluate(uncertain, 200); engine.evaluate(uncertain, 250); engine.evaluate(uncertain, 300);
    expect(engine.evaluate(tone(196), 350).stableMs).toBe(0);
    engine.evaluate(quiet, 400);
    expect(engine.evaluate(tone(196), 450).stableMs).toBe(0);
  });
  it('resets on sustained wrong pitch and accepts a sudden genuine next note', () => {
    const engine = new ExerciseEngine([OPEN_STRINGS[0], OPEN_STRINGS[1]]);
    engine.evaluate(tone(196), 0); engine.evaluate(tone(196), 50);
    for (let t = 100; t <= 400; t += 50) expect(engine.evaluate(tone(220), t).state).toBe('wrong');
    expect(engine.evaluate(tone(196), 450).stableMs).toBe(0);
    for (let t = 500; t <= 800; t += 50) engine.evaluate(tone(196), t);
    expect(engine.index).toBe(1);
    expect(engine.evaluate(tone(293.66), 850).state).toBe('release');
    expect(engine.evaluate(tone(293.66), 900).state).toBe('matching');
  });
  it('does not treat a glitch as release between identical notes', () => {
    const engine = new ExerciseEngine([OPEN_STRINGS[0], OPEN_STRINGS[0]]);
    for (let t = 0; t <= 350; t += 50) engine.evaluate(tone(196), t);
    engine.evaluate(quiet, 400);
    engine.evaluate(tone(196), 450);
    engine.evaluate(quiet, 500);
    engine.evaluate(uncertain, 550);
    engine.evaluate(tone(293.66), 575);
    expect(engine.evaluate(tone(196), 600).state).toBe('release');
    expect(engine.index).toBe(1);
  });
  it('needs a stable correct note and ignores wrong or uncertain readings', () => {
    const engine = new ExerciseEngine(OPEN_STRINGS);
    expect(engine.evaluate(tone(293.66), 0).state).toBe('wrong');
    expect(engine.evaluate(tone(196), 50).state).toBe('matching');
    expect(engine.evaluate(uncertain, 100).state).toBe('uncertain');
    expect(engine.evaluate(tone(196), 150).stableMs).toBe(100);
    for (let t = 200; t < 400; t += 50) expect(engine.evaluate(tone(196), t).index).toBe(0);
    expect(engine.evaluate(tone(196), 400).advanced).toBe(true);
    expect(engine.index).toBe(1);
  });
  it('requires a release or different note before another target advances', () => {
    const engine = new ExerciseEngine([OPEN_STRINGS[0], OPEN_STRINGS[0]]);
    for (let t = 0; t <= 350; t += 50) engine.evaluate(tone(196), t);
    expect(engine.index).toBe(1);
    for (let t = 400; t <= 1000; t += 50) expect(engine.evaluate(tone(196), t).state).toBe('release');
    expect(engine.index).toBe(1);
    engine.evaluate(quiet, 1050);
    engine.evaluate(quiet, 1250);
    for (let t = 1300; t <= 1650; t += 50) engine.evaluate(tone(196), t);
    expect(engine.evaluate(tone(196), 1700).complete).toBe(true);
  });
  it('completes all four notes in order', () => {
    const engine = new ExerciseEngine(OPEN_STRINGS);
    let time = 0;
    for (const [index, note] of OPEN_STRINGS.entries()) {
      if (index) { engine.evaluate(quiet, time += 50); engine.evaluate(quiet, time += 200); }
      let result = engine.evaluate(tone(note.frequency), time += 50);
      for (let t = 0; t < 7; t++) result = engine.evaluate(tone(note.frequency), time += 50);
      expect(result.index).toBe(index + 1);
    }
    expect(engine.evaluate(tone(659.26), time + 50).complete).toBe(true);
  });
});
