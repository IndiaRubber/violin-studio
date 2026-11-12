import { describe, expect, it } from 'vitest';
import { PitchPipeline } from './pitch';

const SIZE = 4096;
function signal(hz: number, sampleRate: number, harmonics: number[] = [1], amplitude = 0.2) {
  return Float32Array.from({ length: SIZE }, (_, i) => harmonics.reduce((sum, strength, harmonic) => sum + strength * amplitude * Math.sin(2 * Math.PI * hz * (harmonic + 1) * i / sampleRate), 0));
}

describe('Pitchy signal pipeline', () => {
  it('quarantines one octave error and resumes without stale output', () => {
    const pipeline = new PitchPipeline();
    for (let i = 0; i < 4; i++) expect(pipeline.process(signal(196, 48000, [0.6, 1, 0.4]), 48000).reason).toBe('ok');
    const glitch = pipeline.process(signal(392, 48000), 48000);
    expect(glitch.reason).toBe('outlier');
    expect(glitch.smoothHz).toBeNull();
    expect(pipeline.process(signal(196, 48000), 48000).smoothHz).toBeCloseTo(196, 0);
  });
  it('expires smoothing after consecutive noise frames and accepts a genuine transition', () => {
    const pipeline = new PitchPipeline();
    pipeline.process(signal(196, 48000), 48000);
    const noise = Float32Array.from({ length: SIZE }, (_, i) => (((i * 1664525 + 1013904223) >>> 0) / 0xffffffff - 0.5) * 0.3);
    for (let i = 0; i < 3; i++) expect(pipeline.process(noise, 48000).smoothHz).toBeNull();
    expect(pipeline.process(signal(293.66, 48000), 48000).smoothHz).toBeCloseTo(293.66, 0);
    expect(pipeline.process(new Float32Array(SIZE), 48000).smoothHz).toBeNull();
  });
  it('handles vibrato and a short noisy onset without accepting the transient', () => {
    const pipeline = new PitchPipeline();
    for (const cents of [-12, 0, 12, -10, 10]) {
      const hz = 440 * 2 ** (cents / 1200);
      expect(pipeline.process(signal(hz, 48000, [0.5, 1, 0.45]), 48000).reason).toBe('ok');
    }
    expect(pipeline.process(signal(880, 48000), 48000).reason).toBe('uncertain'); // outside configured range
    expect(pipeline.process(signal(440, 48000), 48000).note).toBe('A4');
  });
  for (const rate of [44100, 48000]) {
    it(`detects open strings and harmonic-rich audio at ${rate} Hz`, () => {
      const pipeline = new PitchPipeline();
      for (const hz of [196, 293.66, 440, 659.26]) {
        pipeline.reset();
        const reading = pipeline.process(signal(hz, rate, [0.55, 1, 0.65, 0.3]), rate);
        expect(reading.reason).toBe('ok');
        expect(reading.smoothHz).toBeCloseTo(hz, 0);
      }
    });
    it(`resolves slightly sharp and flat A4 at ${rate} Hz`, () => {
      const pipeline = new PitchPipeline();
      for (const cents of [-20, 20]) {
        pipeline.reset();
        const hz = 440 * 2 ** (cents / 1200);
        const reading = pipeline.process(signal(hz, rate), rate);
        expect(reading.smoothHz).toBeCloseTo(hz, 0);
      }
    });
    it(`rejects silence, low level and deterministic noise at ${rate} Hz`, () => {
      const pipeline = new PitchPipeline();
      expect(pipeline.process(new Float32Array(SIZE), rate).reason).toBe('quiet');
      expect(pipeline.process(signal(440, rate, [1], 0.003), rate).reason).toBe('quiet');
      const noise = Float32Array.from({ length: SIZE }, (_, i) => (((i * 1664525 + 1013904223) >>> 0) / 0xffffffff - 0.5) * 0.3);
      expect(pipeline.process(noise, rate).reason).toBe('uncertain');
    });
    it(`does not mistake a strong second harmonic for an octave at ${rate} Hz`, () => {
      const reading = new PitchPipeline().process(signal(220, rate, [0.35, 1, 0.5]), rate);
      expect(reading.smoothHz).toBeCloseTo(220, 0);
    });
  }
});
