import { describe, expect, it } from 'vitest';
import { EXERCISES, findExercise, practiceNotes } from './curriculum';
import type { PitchReading } from './pitch';
import { PracticeSession } from './practice-session';
import { SustainEngine, type PracticeEvaluation } from './sustain';

const STEP = 50;
const tone = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.98, rms: 0.1, note: null, reason: 'ok' });
const quiet: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };
const uncertain: PitchReading = { rawHz: 300, smoothHz: null, clarity: 0.4, rms: 0.05, note: null, reason: 'uncertain' };

class Clock {
  now = 0;
  last!: PracticeEvaluation;
  constructor(private target: { evaluate(r: PitchReading, t: number): PracticeEvaluation }) {}
  feed(reading: PitchReading, ms: number) {
    const end = this.now + ms;
    while (this.now < end) { this.now += STEP; this.last = this.target.evaluate(reading, this.now); if (this.last.advanced || this.last.reset) break; }
    return this.last;
  }
}

/** Finds and holds note `i` with a perfect synthetic pitch; returns hold duration in ms. */
function playNote(clock: Clock, hz: number) {
  clock.feed(quiet, 250); // lift the bow between notes
  const found = clock.feed(tone(hz), 400); // Phase A: 350 ms stable
  if (found.advanced) return 0; // quick mode accepts at this point
  const start = clock.now;
  const result = clock.feed(tone(hz), 20_000);
  expect(result.advanced).toBe(true);
  return clock.now - start;
}

describe('per-note durations', () => {
  const scale = practiceNotes(findExercise('d-major-scale')!);

  it('holds half notes for two beats and whole notes for four', () => {
    const engine = new SustainEngine(scale, 80);
    const clock = new Clock(engine);
    expect(engine.beats).toBe(2);
    expect(engine.requiredMs).toBe(1500);
    expect(playNote(clock, scale[0].frequency)).toBe(1500);
    const holds = scale.slice(1).map(note => playNote(clock, note.frequency));
    expect(holds.slice(0, 13).every(ms => ms === 1500)).toBe(true);
    expect(holds.at(-1)).toBe(3000); // final D4 is a whole note
    expect(clock.last.complete).toBe(true);
  });

  it.each([[40, 3000], [60, 2000], [80, 1500], [120, 1000]])('a half note at %i BPM lasts %i ms', (bpm, ms) => {
    const clock = new Clock(new SustainEngine(scale, bpm));
    expect(playNote(clock, scale[0].frequency)).toBe(ms);
  });

  it('reports beats for the current note and counts beat 1–2 in a half note', () => {
    const engine = new SustainEngine(scale, 60);
    const clock = new Clock(engine);
    clock.feed(tone(scale[0].frequency), 400);
    expect(clock.last).toMatchObject({ phase: 'hold', beats: 2, beat: 1 });
    expect(clock.feed(tone(scale[0].frequency), 1000)).toMatchObject({ beat: 2, beats: 2 });
  });

  it('advances through a scale in order, ascending then descending', () => {
    const notes = practiceNotes(findExercise('g-major-scale')!);
    const session = new PracticeSession(notes, 'sustain', 120);
    const clock = new Clock(session);
    const seen: number[] = [];
    for (const note of notes) { seen.push(session.index); playNote(clock, note.frequency); }
    expect(seen).toEqual(notes.map((_, i) => i));
    expect(clock.last.complete).toBe(true);
  });

  it('does not accept a note played in the wrong order', () => {
    const session = new PracticeSession(scale, 'sustain', 120);
    const clock = new Clock(session);
    clock.feed(tone(scale[2].frequency), 5000); // F♯4 before D4
    expect(session.index).toBe(0);
    expect(clock.last.state).toBe('wrong');
  });
});

describe('short-duration stability (half note at 120 BPM = 1 s)', () => {
  const notes = practiceNotes(findExercise('d-major-scale')!);
  const D4 = notes[0].frequency;

  it('still needs 350 ms of stable pitch before counting', () => {
    const clock = new Clock(new SustainEngine(notes, 120));
    expect(clock.feed(tone(D4), 350).phase).toBe('find');
    expect(clock.feed(tone(D4), 50).phase).toBe('hold');
  });

  it('tolerates one brief interruption even though 25% of the note is only 250 ms', () => {
    const engine = new SustainEngine(notes, 120);
    expect(engine.faultBudgetMs).toBe(450);
    const clock = new Clock(engine);
    clock.feed(tone(D4), 400);
    clock.feed(tone(D4), 200);
    clock.feed(quiet, 350); // a bow change
    expect(clock.last.reset).toBeNull();
    const done = clock.feed(tone(D4), 2000);
    expect(done.advanced).toBe(true);
  });

  it('resets a short note that is mostly unsteady', () => {
    const clock = new Clock(new SustainEngine(notes, 120));
    clock.feed(tone(D4), 400);
    let result = clock.last;
    for (let i = 0; i < 6 && !result.reset; i++) { clock.feed(tone(D4), 100); result = clock.feed(uncertain, 250); }
    expect(result.reset).toBe('unsteady');
  });

  it('cannot complete from a dropout at the end of a short note', () => {
    const clock = new Clock(new SustainEngine(notes, 120));
    clock.feed(tone(D4), 400);
    clock.feed(tone(D4), 900);
    expect(clock.feed(quiet, 400).advanced).toBe(false);
    expect(clock.feed(quiet, 100).reset).toBe('lost');
  });

  it('keeps the whole-note budget unchanged (25% of 4 s at 60 BPM)', () => {
    const engine = new SustainEngine(practiceNotes(findExercise('open-strings')!), 60);
    expect(engine.faultBudgetMs).toBe(1000);
  });
});

describe('repeated notes and release', () => {
  it('first-finger exercise: E4–E4 across a barline needs a release', () => {
    const notes = practiceNotes(findExercise('first-finger')!);
    expect(notes[1].name).toBe('E4');
    expect(notes[2].name).toBe('E4');
    const session = new PracticeSession(notes, 'sustain', 120);
    const clock = new Clock(session);
    playNote(clock, notes[0].frequency);
    clock.feed(quiet, 250); clock.feed(tone(notes[1].frequency), 400); clock.feed(tone(notes[1].frequency), 5000);
    expect(session.index).toBe(2);
    expect(clock.feed(tone(notes[1].frequency), 5000).state).toBe('release'); // one long bow cannot play both
    expect(session.index).toBe(2);
    playNote(clock, notes[2].frequency);
    expect(session.index).toBe(3);
  });

  it('suppresses the reference tone for half notes too', () => {
    const notes = practiceNotes(findExercise('d-major-scale')!);
    const session = new PracticeSession(notes, 'sustain', 120);
    const clock = new Clock(session);
    session.suppress(3000);
    expect(clock.feed(tone(notes[0].frequency), 2950).state).toBe('reference');
    expect(session.index).toBe(0);
    expect(clock.feed(tone(notes[0].frequency), 50).state).toBe('matching');
  });
});

describe('every library exercise can be completed', () => {
  it.each(EXERCISES.map(e => [e.number, e.id] as const))('%s %s in guided and quick modes', (_, id) => {
    const exercise = findExercise(id)!;
    const notes = practiceNotes(exercise, 442);
    for (const mode of ['sustain', 'quick'] as const) {
      const session = new PracticeSession(notes, mode, exercise.tempo);
      const clock = new Clock(session);
      for (const note of notes) playNote(clock, note.frequency);
      expect(clock.last.complete).toBe(true);
      expect(session.index).toBe(notes.length);
    }
  });
});
