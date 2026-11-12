import { describe, expect, it } from 'vitest';
import { classifyString, formatCents, nearestNote, referenceFrequency, TunerPresentation, VIOLIN_STRINGS } from './tuner-logic';
import { centsFromTarget } from './music';
import type { PitchReading } from './pitch';
import { PitchPipeline, TUNER_PITCH_SETTINGS } from './pitch';

const reading = (hz: number): PitchReading => ({ rawHz: hz, smoothHz: hz, clarity: 0.98, rms: 0.1, note: null, reason: 'ok' });
describe('tuner calculations', () => {
  const synthetic = (hz: number, rate = 48000) => Float32Array.from({ length: 4096 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * hz * i / rate));
  it('tracks full-pipeline glides and vibrato without blanks', () => {
    for (const speed of [150, 300, 600]) {
      const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
      let blanks = 0;
      for (let frame = 0; frame < 39; frame++) {
        const hz = 440 * 2 ** ((speed * frame * 0.05) / 1200);
        const result = pipeline.process(synthetic(hz), 48000);
        if (result.reason !== 'ok') blanks++;
      }
      expect(blanks).toBe(0);
    }
    for (const depth of [25, 40]) {
      const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
      let blanks = 0;
      for (let frame = 0; frame < 39; frame++) {
        const hz = 440 * 2 ** ((depth * Math.sin(frame * 0.8)) / 1200);
        if (pipeline.process(synthetic(hz), 48000).reason !== 'ok') blanks++;
      }
      expect(blanks).toBe(0);
    }
  });
  it('quarantines an isolated octave then accepts a genuine abrupt transition', () => {
    const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
    pipeline.process(synthetic(440), 48000);
    expect(pipeline.process(synthetic(880), 48000).reason).toBe('outlier');
    expect(pipeline.process(synthetic(440), 48000).reason).toBe('ok');
    expect(pipeline.process(synthetic(523.25), 48000).reason).toBe('outlier');
    expect(pipeline.process(synthetic(523.25), 48000).note).toBe('C5');
  });
  it('distinguishes unsupported reliable pitch from noise and silence', () => {
    const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
    expect(pipeline.process(synthetic(988), 48000).note).toBe('B5');
    expect(pipeline.process(new Float32Array(4096), 48000).reason).toBe('quiet');
    expect(pipeline.process(synthetic(1250), 48000).reason).toBe('unsupported');
  });
  it('expires tuner history through prolonged low-confidence input', () => {
    const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
    const display = new TunerPresentation();
    display.next(pipeline.process(synthetic(440), 48000));
    let seed = 0x12345678;
    const noise = Float32Array.from({ length: 4096 }, () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) / 0xffffffff - 0.5) * 0.3;
    });
    for (let i = 0; i < 4; i++) {
      const result = pipeline.process(noise, 48000);
      expect(result.reason).toBe('uncertain');
      expect(display.next(result)).toBeNull();
    }
    expect(display.next(pipeline.process(synthetic(523.25), 48000))).toBeCloseTo(523.25, 0);
  });
  it('guides detuned selected strings without confusing neighboring semitones', () => {
    for (const cents of [-300, -150, -80, -30, 30, 80, 150, 300]) {
      const result = classifyString(196 * 2 ** (cents / 1200), 'g3');
      expect(result.kind).toBe('selected');
      expect(Math.sign(result.cents!)).toBe(Math.sign(cents));
    }
    expect(classifyString(196 * 2 ** (-51 / 1200), 'g3').message).toContain('Very flat');
    expect(classifyString(293.66, 'g3').kind).toBe('other');
    expect(classifyString(392, 'g3').kind).toBe('octave');
    expect(classifyString(196 * 2 ** (9.9 / 1200), 'g3').message).toBe('In tune');
    expect(classifyString(196 * 2 ** (10.1 / 1200), 'g3').message).toContain('Sharp');
    expect(formatCents(0.4)).toBe('0 cents');
    expect(formatCents(-0.4)).toBe('0 cents');
  });
  it('maps every violin string at A4 440 and gets the correct octave', () => {
    expect(VIOLIN_STRINGS.map(s => nearestNote(s.frequency)?.name)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(nearestNote(880)?.name).toBe('A5');
    expect(nearestNote(220)?.name).toBe('A3');
  });
  it('maps chromatic notes and signed cents at an adjustable reference', () => {
    expect(nearestNote(261.626)?.name).toBe('C4');
    expect(nearestNote(466.164)?.name).toBe('A♯4');
    expect(referenceFrequency(69, 442)).toBe(442);
    expect(referenceFrequency(62, 442)).toBeCloseTo(295, 0);
    expect(nearestNote(442, 442)?.cents).toBeCloseTo(0, 5);
    expect(nearestNote(440, 442)!.cents).toBeLessThan(0);
    expect(centsFromTarget(440 * 2 ** (15 / 1200), 440)).toBeCloseTo(15, 5);
    expect(centsFromTarget(440 * 2 ** (-15 / 1200), 440)).toBeCloseTo(-15, 5);
  });
  it('smooths jitter but follows gradual movement and real note transitions', () => {
    const filter = new TunerPresentation();
    expect(filter.next(reading(440))).toBe(440);
    expect(filter.next(reading(442))!).toBeGreaterThan(440);
    expect(filter.next(reading(444))!).toBeGreaterThan(441);
    expect(filter.next(reading(587.33))).toBeCloseTo(587.33, 1);
  });
  it('does not present stale values through outliers, uncertainty, or silence', () => {
    const filter = new TunerPresentation();
    filter.next(reading(440));
    expect(filter.next({ ...reading(880), reason: 'outlier', smoothHz: null })).toBeNull();
    expect(filter.next({ ...reading(440), reason: 'uncertain', clarity: 0.2, smoothHz: null })).toBeNull();
    expect(filter.next({ ...reading(440), reason: 'uncertain', clarity: 0.2, smoothHz: null })).toBeNull();
    expect(filter.next(reading(442))).toBe(442);
    expect(filter.next({ ...reading(0), rawHz: null, smoothHz: null, reason: 'quiet' })).toBeNull();
    expect(filter.next(reading(440))).toBe(440);
  });
  it('shows a decaying harmonic-rich pluck only while its signal is reliable', () => {
    for (const rate of [44100, 48000]) {
      const pipeline = new PitchPipeline(4096, TUNER_PITCH_SETTINGS);
      const display = new TunerPresentation();
      const pluck = Float32Array.from({ length: 4096 }, (_, i) =>
        Math.exp(-i / 2200) * (0.12 * Math.sin(2 * Math.PI * 440 * i / rate) + 0.18 * Math.sin(2 * Math.PI * 880 * i / rate)));
      const first = pipeline.process(pluck, rate);
      expect(first.reason).toBe('ok');
      expect(display.next(first)).toBeCloseTo(440, 0);
      const silence = pipeline.process(new Float32Array(4096), rate);
      expect(display.next(silence)).toBeNull();
    }
  });
});
