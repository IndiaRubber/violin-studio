import { describe, expect, it } from 'vitest';
import { OPEN_STRINGS } from './music';
import type { PitchReading } from './pitch';
import { exerciseNotes, PracticeSession } from './practice-session';
import { SustainEngine, type PracticeEvaluation } from './sustain';

const STEP = 50; // matches the 50 ms audio poll
const FIND = 400; // first frame + 350 ms of stability
const tone = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.98, rms: 0.1, note: null, reason: 'ok' });
const cents = (hz: number, c: number) => hz * 2 ** (c / 1200);
const quiet: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };
const uncertain: PitchReading = { rawHz: 196, smoothHz: null, clarity: 0.4, rms: 0.05, note: null, reason: 'uncertain' };
const G3 = OPEN_STRINGS[0].frequency;
const D4 = OPEN_STRINGS[1].frequency;

/** Deterministic driver with a controllable clock. */
class Clock {
  now = 0;
  last!: PracticeEvaluation;
  constructor(private target: { evaluate(r: PitchReading, t: number): PracticeEvaluation }) {}
  feed(reading: PitchReading, ms: number) {
    const end = this.now + ms;
    while (this.now < end) { this.now += STEP; this.last = this.target.evaluate(reading, this.now); if (this.last.advanced || this.last.reset) break; }
    return this.last;
  }
  /** Feed until the target advances (or resets) or `limit` ms elapse. */
  untilAdvance(reading: PitchReading, limit = 20_000) { return this.feed(reading, limit); }
}

describe('sustained whole-note practice', () => {
  it('waits indefinitely in Phase A without counting while the pitch is wrong', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]]);
    const clock = new Clock(engine);
    expect(clock.feed(tone(D4), 30_000).phase).toBe('find');
    expect(clock.last.state).toBe('wrong');
    expect(clock.last.holdMs).toBe(0);
    expect(clock.feed(quiet, 30_000).phase).toBe('find');
    expect(engine.index).toBe(0);
  });

  it('enters the hold after a stable pitch, then accepts after four beats at 60 BPM', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    expect(clock.feed(tone(G3), 350).state).toBe('matching'); // 300 ms stable so far
    const start = clock.feed(tone(G3), 50);
    expect(start.phase).toBe('hold');
    expect(start.beat).toBe(1);
    const holdStart = clock.now;
    expect(clock.feed(tone(G3), 1000).beat).toBe(2);
    expect(clock.feed(tone(G3), 1000).beat).toBe(3);
    expect(clock.feed(tone(G3), 1000).beat).toBe(4);
    const done = clock.untilAdvance(tone(G3));
    expect(done.advanced).toBe(true);
    expect(done.complete).toBe(true);
    expect(clock.now - holdStart).toBe(4000);
  });

  it.each([[40, 6000], [60, 4000], [80, 3000], [120, 2000]])('holds for the written duration at %i BPM', (bpm, ms) => {
    const engine = new SustainEngine([OPEN_STRINGS[2]], bpm);
    const clock = new Clock(engine);
    clock.feed(tone(440), FIND);
    expect(clock.last.phase).toBe('hold');
    const holdStart = clock.now;
    const done = clock.untilAdvance(tone(440));
    expect(done.advanced).toBe(true);
    expect(clock.now - holdStart).toBe(ms);
    expect(done.requiredMs).toBe(ms);
  });

  it('tolerates brief instability and normal drift without resetting the beat count', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND);
    const holdStart = clock.now;
    clock.feed(tone(G3), 1000);
    expect(clock.feed(uncertain, 50).state).toBe('wavering'); // one bad frame
    clock.feed(tone(cents(G3, 30)), 500); // drifting 30 cents sharp, inside hold tolerance
    clock.feed(quiet, 250); // bow change
    clock.feed(tone(cents(G3, -12)), 500);
    expect(clock.last.phase).toBe('hold');
    expect(clock.last.beat).toBe(3);
    const done = clock.untilAdvance(tone(G3));
    expect(done.advanced).toBe(true);
    expect(clock.now - holdStart).toBe(4000);
  });

  it('resets the current note after prolonged pitch loss, keeping earlier notes', () => {
    const engine = new SustainEngine(OPEN_STRINGS.slice(0, 2), 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND); clock.untilAdvance(tone(G3));
    clock.feed(quiet, 300);
    clock.feed(tone(D4), FIND);
    expect(clock.last.phase).toBe('hold');
    clock.feed(tone(D4), 1500);
    clock.feed(quiet, 400);
    expect(clock.last.phase).toBe('hold');
    const reset = clock.feed(quiet, 100);
    expect(reset.reset).toBe('lost');
    expect(reset.phase).toBe('find');
    expect(engine.index).toBe(1);
    expect(clock.feed(tone(D4), 300).state).toBe('matching'); // must find it again
  });

  it('resets on a sustained incorrect pitch during the hold', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND);
    clock.feed(tone(G3), 1000);
    expect(clock.feed(tone(cents(G3, 60)), 300).state).toBe('wavering');
    let result = clock.last;
    for (let i = 0; i < 10 && !result.reset; i++) result = clock.feed(tone(cents(G3, 60)), 50);
    expect(result.reset).toBe('lost');
    expect(result.state).toBe('wrong');
    expect(result.phase).toBe('find');
  });

  it('resets when a hold is mostly unsteady even if each lapse is short', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND);
    let result = clock.last;
    for (let i = 0; i < 40 && !result.reset; i++) { clock.feed(tone(G3), 100); result = clock.feed(uncertain, 300); }
    expect(result.reset).toBe('unsteady');
    expect(engine.index).toBe(0);
  });

  it('does not bridge a microphone interruption with one fresh frame', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    {
      let t = 0;
      for (; t <= 350; t += STEP) engine.evaluate(tone(G3), t);
      expect(engine.evaluate(tone(G3), t).phase).toBe('hold');
      // No readings arrive for 2 s (suspended AudioContext / track lost), then one good frame.
      const after = engine.evaluate(tone(G3), t + 2000);
      expect(after.reset).toBe('lost');
      expect(after.advanced).toBe(false);
    }
  });

  it('cannot complete from silence or a stale estimate at the end of the hold', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND);
    clock.feed(tone(G3), 3800);
    const end = clock.feed(quiet, 400); // duration elapses during silence
    expect(end.advanced).toBe(false);
    expect(clock.feed(quiet, 100).reset).toBe('lost');
    expect(engine.index).toBe(0);
    // Uncertain readings carry a raw frequency but no verified smoothed pitch.
    const engine2 = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock2 = new Clock(engine2);
    clock2.feed(tone(G3), FIND); clock2.feed(tone(G3), 3900);
    expect(clock2.feed({ ...uncertain, rawHz: G3 }, 300).advanced).toBe(false);
  });

  it('requires a release or new pitch between repeated identical notes', () => {
    const engine = new SustainEngine(exerciseNotes('g3'), 120);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND); clock.untilAdvance(tone(G3));
    expect(engine.index).toBe(1);
    expect(clock.feed(tone(G3), 10_000).state).toBe('release'); // continuous bow cannot pass note 2
    expect(engine.index).toBe(1);
    clock.feed(quiet, 250); // 180 ms of quiet releases the bow
    clock.feed(tone(G3), FIND); clock.untilAdvance(tone(G3));
    expect(engine.index).toBe(2);
  });

  it('a tempo change restarts only the current hold with the new duration', () => {
    const engine = new SustainEngine([OPEN_STRINGS[0]], 60);
    const clock = new Clock(engine);
    clock.feed(tone(G3), FIND); clock.feed(tone(G3), 2000);
    engine.setTempo(120);
    expect(clock.feed(tone(G3), 50).phase).toBe('find');
    expect(clock.feed(tone(G3), 350).phase).toBe('hold');
    const holdStart = clock.now;
    clock.untilAdvance(tone(G3));
    expect(clock.now - holdStart).toBe(2000);
  });

  it('restarts the current note and the whole exercise on request', () => {
    const notes = exerciseNotes('all');
    let session = new PracticeSession(notes, 'sustain', 120);
    const clock = new Clock(session);
    clock.feed(tone(G3), FIND); clock.untilAdvance(tone(G3));
    clock.feed(quiet, 250); clock.feed(tone(D4), FIND); clock.feed(tone(D4), 500);
    expect(clock.last.phase).toBe('hold');
    session.restartNote();
    expect(clock.feed(tone(D4), 50).phase).toBe('find');
    expect(session.index).toBe(1);
    session = new PracticeSession(notes, 'sustain', 120); // restart exercise = fresh session
    expect(session.index).toBe(0);
  });
});

describe('practice session', () => {
  it('builds whole-note exercises for all strings or one focused string', () => {
    expect(exerciseNotes('all').map(n => n.name)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(exerciseNotes('a4').map(n => n.name)).toEqual(['A4', 'A4', 'A4', 'A4']);
    expect(new Set(exerciseNotes('a4').map(n => n.id)).size).toBe(4);
  });

  it('quick mode keeps the original 350 ms recognition behaviour', () => {
    const session = new PracticeSession(exerciseNotes('all'), 'quick');
    const clock = new Clock(session);
    const result = clock.untilAdvance(tone(G3));
    expect(result.advanced).toBe(true);
    expect(clock.now).toBe(400); // first frame at 50 ms + 350 ms stable
    expect(result.holdMs).toBe(0);
  });

  it('sustained mode does not advance at the quick-mode threshold', () => {
    const session = new PracticeSession(exerciseNotes('all'), 'sustain', 60);
    const clock = new Clock(session);
    expect(clock.feed(tone(G3), 1000).advanced).toBe(false);
    expect(session.index).toBe(0);
  });

  it('ignores the reference tone and its settling period in both modes', () => {
    for (const mode of ['sustain', 'quick'] as const) {
      const session = new PracticeSession(exerciseNotes('all'), mode, 120);
      const clock = new Clock(session);
      session.suppress(2000);
      const during = clock.feed(tone(G3), 1950); // the mic hears the reference at the exact target pitch
      expect(during.state).toBe('reference');
      expect(during.advanced).toBe(false);
      expect(session.index).toBe(0);
      // After suppression ends the student must establish the pitch from scratch.
      const first = clock.feed(tone(G3), 50);
      expect(first.state).toBe('matching');
      expect(first.stableMs).toBe(0);
    }
  });

  it('exposes the suppression window so a restarted exercise can inherit it', () => {
    const session = new PracticeSession(exerciseNotes('all'), 'quick');
    session.suppress(1500);
    const restarted = new PracticeSession(exerciseNotes('all'), 'quick');
    restarted.suppress(session.suppressionEnd);
    const clock = new Clock(restarted);
    expect(clock.feed(tone(G3), 1400).state).toBe('reference');
    expect(restarted.index).toBe(0);
  });

  it('playing the reference during a hold abandons that hold', () => {
    const session = new PracticeSession(exerciseNotes('all'), 'sustain', 60);
    const clock = new Clock(session);
    clock.feed(tone(G3), FIND); clock.feed(tone(G3), 3000);
    expect(clock.last.phase).toBe('hold');
    session.suppress(clock.now + 2000);
    clock.feed(tone(G3), 2000);
    expect(clock.feed(tone(G3), 50).phase).toBe('find');
    expect(session.index).toBe(0);
  });
});
