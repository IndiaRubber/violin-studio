import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_TONE } from './config';
import { ReferenceTonePlayer } from './tone';

function fakeContext(state: AudioContextState = 'running') {
  const events: [string, number, number?][] = [];
  interface FakeOscillator { hz: number; onended: (() => void) | null; stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
  const oscillators: FakeOscillator[] = [];
  const gains: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    currentTime: 10, state, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
    createPeriodicWave: vi.fn(() => ({})),
    createOscillator: vi.fn(() => {
      const osc = { hz: 0, onended: null, setPeriodicWave: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: (node: unknown) => node, frequency: { setValueAtTime: (value: number) => { osc.hz = value; } } } as FakeOscillator & Record<string, unknown>;
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const param = { value: 0, setValueAtTime: (v: number, t: number) => events.push(['set', v, t]), linearRampToValueAtTime: (v: number, t: number) => events.push(['ramp', v, t]), cancelScheduledValues: (t: number) => events.push(['cancel', t]) };
      const gain = { gain: param, disconnect: vi.fn(), connect: (node: unknown) => node };
      gains.push(gain);
      return gain;
    }),
  };
  return { context, events, oscillators, gains };
}

describe('reference tone playback', () => {
  it('creates audio only when played and schedules a quiet, click-free envelope at the target pitch', async () => {
    const fake = fakeContext();
    const create = vi.fn(() => fake.context as never);
    const player = new ReferenceTonePlayer(create);
    expect(create).not.toHaveBeenCalled();
    const duration = await player.play(196);
    expect(duration).toBe(REFERENCE_TONE.durationMs);
    expect(fake.oscillators[0].hz).toBe(196);
    const levels = fake.events.map(e => e[1]);
    expect(Math.max(...levels)).toBeLessThanOrEqual(0.2);
    expect(fake.events[0]).toEqual(['set', 0, 10.01]); // starts silent
    expect(fake.events.at(-1)?.[0]).toBe('ramp');
    expect(fake.events.at(-1)?.[1]).toBe(0); // ramps back to silence
    expect(fake.events[1][2]! - 10.01).toBeCloseTo(REFERENCE_TONE.attackMs / 1000, 5);
    expect(player.playing).toBe(true);
  });

  it('resumes a suspended context inside the user gesture', async () => {
    const fake = fakeContext('suspended');
    await new ReferenceTonePlayer(() => fake.context as never).play(440);
    expect(fake.context.resume).toHaveBeenCalledOnce();
  });

  it('disconnects nodes when the tone ends and reports completion once', async () => {
    const fake = fakeContext();
    const player = new ReferenceTonePlayer(() => fake.context as never);
    const onEnd = vi.fn();
    await player.play(440, onEnd);
    fake.oscillators[0].onended?.();
    expect(fake.oscillators[0].disconnect).toHaveBeenCalledOnce();
    expect(fake.gains[0].disconnect).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(player.playing).toBe(false);
  });

  it('replacing a tone fades the old one without reporting it as finished', async () => {
    const fake = fakeContext();
    const player = new ReferenceTonePlayer(() => fake.context as never);
    const first = vi.fn();
    await player.play(196, first);
    await player.play(293.66);
    expect(fake.oscillators[0].stop).toHaveBeenCalledTimes(2); // scheduled end + early fade
    fake.oscillators[0].onended?.();
    expect(first).not.toHaveBeenCalled();
    expect(player.playing).toBe(true);
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('dispose stops playback, releases nodes and closes the context', async () => {
    const fake = fakeContext();
    const player = new ReferenceTonePlayer(() => fake.context as never);
    const onEnd = vi.fn();
    await player.play(659.26, onEnd);
    player.dispose();
    expect(fake.gains[0].disconnect).toHaveBeenCalled();
    expect(fake.context.close).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(player.playing).toBe(false);
  });
});
