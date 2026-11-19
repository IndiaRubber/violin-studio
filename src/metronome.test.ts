import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metronome, clickSamples } from './metronome';
import { PRACTICE } from './config';
import { PitchPipeline } from './pitch';
import { PracticeSession } from './practice-session';

function fixture(ready: () => Promise<void> = async () => {}) {
  const pulses = vi.fn();
  const audioError = vi.fn();
  const beats: number[] = [];
  const output = { ready, schedule: vi.fn((delay: number) => beats.push(Date.now() + delay)), cancel: vi.fn(), close: vi.fn() };
  const makeOutput = vi.fn(() => output);
  const metronome = new Metronome(pulses, audioError, Date.now, makeOutput);
  return { metronome, output, makeOutput, beats, pulses, audioError };
}

describe('practice metronome', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => vi.useRealTimers());

  it('schedules stable beat intervals and pulses without accumulating polling drift', async () => {
    const { metronome, beats, pulses, output } = fixture();
    metronome.start(60, true);
    await vi.advanceTimersByTimeAsync(2300);
    expect(beats).toEqual([60, 1060, 2060]);
    expect(pulses.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
    metronome.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(beats).toHaveLength(3);
    expect(output.close).toHaveBeenCalledOnce();
  });

  it('reschedules pending beats immediately when the exercise tempo changes', async () => {
    const { metronome, beats, output } = fixture();
    metronome.start(60, true);
    await vi.advanceTimersByTimeAsync(200);
    metronome.setTempo(120);
    await vi.advanceTimersByTimeAsync(700);
    expect(beats).toEqual([60, 260, 760]);
    expect(output.cancel).toHaveBeenCalledOnce();
    metronome.stop();
  });

  it('keeps the visual beat during a reference and resumes on the existing grid', async () => {
    const { metronome, beats, pulses, output } = fixture();
    metronome.start(60, true);
    await vi.advanceTimersByTimeAsync(100);
    metronome.setBlocked(true);
    await vi.advanceTimersByTimeAsync(1200);
    expect(beats).toEqual([60]);
    expect(output.cancel).toHaveBeenCalledOnce();
    expect(pulses.mock.calls).toEqual([[true], [false], [true], [false]]);
    metronome.setBlocked(false);
    await vi.advanceTimersByTimeAsync(900);
    expect(beats).toEqual([60, 2060]);
    metronome.stop();
  });

  it('opens no audio context in visual-only mode and ignores an audio start cancelled while pending', async () => {
    let resolve!: () => void;
    const { metronome, beats, pulses, makeOutput, output } = fixture(() => new Promise<void>(done => { resolve = done; }));
    metronome.start(60, false);
    await vi.advanceTimersByTimeAsync(100);
    expect(pulses).toHaveBeenCalledWith(true);
    expect(makeOutput).not.toHaveBeenCalled();
    metronome.setAudible(true);
    metronome.stop();
    resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(pulses).toHaveBeenLastCalledWith(false);
    expect(output.close).toHaveBeenCalledOnce();
    expect(beats).toEqual([]);
  });

  it('falls back to visual beats when audio cannot start', async () => {
    const { metronome, audioError, pulses, output } = fixture(async () => { throw new Error('blocked'); });
    metronome.start(60, true);
    await vi.advanceTimersByTimeAsync(100);
    expect(audioError).toHaveBeenCalledOnce();
    expect(output.close).toHaveBeenCalledOnce();
    expect(pulses).toHaveBeenCalledWith(true);
    metronome.stop();
  });

  it('skips missed clicks after a clock jump without playing a burst', async () => {
    let now = 0;
    const schedule = vi.fn();
    const metronome = new Metronome(() => {}, () => {}, () => now, () => ({ ready: async () => {}, schedule, cancel: () => {}, close: () => {} }));
    metronome.start(60, true);
    await vi.advanceTimersByTimeAsync(25);
    expect(schedule.mock.calls).toEqual([[60]]);
    now = 10_025;
    await vi.advanceTimersByTimeAsync(25);
    expect(schedule.mock.calls).toEqual([[60], [35]]);
    metronome.stop();
  });

  it('uses a short, quiet click with no DC impulse at either endpoint', () => {
    const samples = clickSamples(48_000);
    expect(samples.length).toBe(1152);
    expect(Math.abs(samples[0])).toBe(0);
    expect(Math.abs(samples.at(-1)!)).toBe(0);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(0.20);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.08);
  });
  it.each([44100, 48000])('rejects click-only input and recognizes pitch across loud clicks at %i Hz', rate => {
    const click = clickSamples(rate);
    const size = PRACTICE.analysisSize;
    for (const onset of [-click.length + 1, -100, 0, 1000, 2000, size - 100]) {
      const leak = Float32Array.from({ length: size }, (_, i) => (click[i - onset] ?? 0) * 1.75);
      expect(new PitchPipeline().process(leak, rate).smoothHz).toBeNull();
      for (const frequency of [196, 293.6648, 440, 659.2551]) {
        const withNote = leak.map((sample, i) => {
          const phase = 2 * Math.PI * frequency * i / rate;
          return sample + 0.08 * Math.sin(phase) + 0.12 * Math.sin(2 * phase) + 0.03 * Math.sin(3 * phase);
        });
        const result = new PitchPipeline().process(withNote, rate);
        expect(result.reason).toBe('ok');
        expect(Math.abs(1200 * Math.log2(result.smoothHz! / frequency))).toBeLessThan(15);
      }
    }
    const pipeline = new PitchPipeline();
    const lesson = new PracticeSession([{ id: 'd4', name: 'D4', vexKey: 'd/4', frequency: 293.6648, beats: 2 }], 'sustain', 120);
    const at = (time: number, voiced: boolean) => {
      const offset = Math.round((time % 500) * rate / 1000);
      return Float32Array.from({ length: size }, (_, i) => {
        const phase = 2 * Math.PI * 293.6648 * i / rate;
        return (click[i - offset] ?? 0) * 1.75 + (voiced ? 0.1 * Math.sin(phase) + 0.13 * Math.sin(2 * phase) : 0);
      });
    };
    for (let time = 0; time < 1500; time += 50) lesson.evaluate(pipeline.process(at(time, false), rate), time);
    expect(lesson.index).toBe(0);
    for (let time = 1500; time <= 3200 && !lesson.index; time += 50) lesson.evaluate(pipeline.process(at(time, true), rate), time);
    expect(lesson.index).toBe(1);
  });

});
