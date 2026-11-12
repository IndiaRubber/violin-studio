import { PitchDetector } from 'pitchy';
import { PRACTICE } from './config';
import { frequencyToNote } from './music';

export interface PitchReading { rawHz: number | null; smoothHz: number | null; clarity: number; rms: number; note: string | null; reason: 'ok' | 'quiet' | 'uncertain' | 'outlier'; }
export interface PitchSettings { minRms: number; minClarity: number; minFrequency: number; maxFrequency: number; maxRejectedFrames: number; maxRawSmoothCents: number; }
export const DEFAULT_PITCH_SETTINGS: PitchSettings = PRACTICE;

export class PitchPipeline {
  private detector: PitchDetector<Float32Array>;
  private history: number[] = [];
  private pendingOutlier: number | null = null;
  private rejectedFrames = 0;
  constructor(size = PRACTICE.analysisSize, private settings: PitchSettings = DEFAULT_PITCH_SETTINGS) {
    this.detector = PitchDetector.forFloat32Array(size);
  }
  reset() { this.history = []; this.pendingOutlier = null; this.rejectedFrames = 0; }
  process(samples: Float32Array, sampleRate: number): PitchReading {
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);
    if (rms < this.settings.minRms) {
      this.reset();
      return { rawHz: null, smoothHz: null, clarity: 0, rms, note: null, reason: 'quiet' };
    }
    const [hz, clarity] = this.detector.findPitch(samples, sampleRate);
    const valid = Number.isFinite(hz) && hz >= this.settings.minFrequency && hz <= this.settings.maxFrequency && clarity >= this.settings.minClarity;
    if (!valid) {
      this.pendingOutlier = null;
      if (++this.rejectedFrames > this.settings.maxRejectedFrames) this.reset();
      return { rawHz: Number.isFinite(hz) && hz > 0 ? hz : null, smoothHz: null, clarity, rms, note: null, reason: 'uncertain' };
    }
    this.rejectedFrames = 0;
    // Quarantine one large jump. Two consistent observations establish a real transition.
    if (this.history.length && Math.abs(1200 * Math.log2(hz / this.history.at(-1)!)) > this.settings.maxRawSmoothCents) {
      if (this.pendingOutlier === null || Math.abs(1200 * Math.log2(hz / this.pendingOutlier)) > 80) {
        this.pendingOutlier = hz;
        return { rawHz: hz, smoothHz: null, clarity, rms, note: null, reason: 'outlier' };
      }
      this.reset();
    } else this.pendingOutlier = null;
    this.history.push(hz);
    if (this.history.length > 5) this.history.shift();
    const sorted = [...this.history].sort((a, b) => a - b);
    const smoothHz = sorted[Math.floor(sorted.length / 2)];
    if (Math.abs(1200 * Math.log2(hz / smoothHz)) > this.settings.maxRawSmoothCents)
      return { rawHz: hz, smoothHz: null, clarity, rms, note: null, reason: 'outlier' };
    return { rawHz: hz, smoothHz, clarity, rms, note: frequencyToNote(smoothHz), reason: 'ok' };
  }
}
