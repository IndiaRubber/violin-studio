import { REFERENCE_TONE } from './config';

type ToneContext = Pick<AudioContext, 'currentTime' | 'state' | 'destination' | 'createOscillator' | 'createGain' | 'createPeriodicWave' | 'resume' | 'close'>;

interface ActiveTone { oscillator: OscillatorNode; gain: GainNode; onEnd?: () => void }

/**
 * Synthesizes a short, quiet reference pitch with the Web Audio API.
 * - The AudioContext is created lazily inside the user's tap, satisfying autoplay rules.
 * - A linear attack/release envelope avoids clicks; peak gain is conservative.
 * - A sine fundamental with two soft overtones stays clean but remains audible on
 *   small phone speakers that roll off low fundamentals such as G3.
 * - Nodes are disconnected when each tone ends; dispose() closes the context.
 * The player is output-only; it never touches the microphone graph.
 */
export class ReferenceTonePlayer {
  private context: ToneContext | null = null;
  private active: ActiveTone | null = null;
  constructor(private createContext: () => ToneContext = () => new AudioContext(), private settings = REFERENCE_TONE) {}

  get playing() { return this.active !== null; }

  /** Starts the tone; returns its duration in ms. Must be called from a user gesture. */
  async play(frequency: number, onEnd?: () => void): Promise<number> {
    if (!Number.isFinite(frequency) || frequency <= 0) throw new Error('Invalid reference frequency.');
    if (this.active) { this.active.onEnd = undefined; this.stop(); this.active = null; } // replaced, not finished
    this.context ??= this.createContext();
    const context = this.context;
    if (context.state === 'suspended') await context.resume();
    if (this.context !== context) return 0; // disposed while resuming
    const { durationMs, attackMs, releaseMs, peakGain } = this.settings;
    const start = context.currentTime + 0.01;
    const end = start + durationMs / 1000;
    const oscillator = context.createOscillator();
    oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.3, 0.1])));
    oscillator.frequency.setValueAtTime(frequency, start);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + attackMs / 1000);
    gain.gain.setValueAtTime(peakGain, end - releaseMs / 1000);
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain).connect(context.destination);
    const tone: ActiveTone = { oscillator, gain, onEnd };
    oscillator.onended = () => this.finish(tone);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
    this.active = tone;
    return durationMs;
  }

  /** Fades out quickly (no click) and releases nodes once the oscillator ends. */
  stop() {
    const tone = this.active;
    if (!tone || !this.context) return;
    const now = this.context.currentTime;
    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(tone.gain.gain.value, now);
    tone.gain.gain.linearRampToValueAtTime(0, now + 0.03);
    try { tone.oscillator.stop(now + 0.04); } catch { /* already stopped */ }
  }

  dispose() {
    const tone = this.active;
    this.stop();
    if (tone) this.finish(tone);
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private finish(tone: ActiveTone) {
    tone.oscillator.onended = null;
    tone.oscillator.disconnect();
    tone.gain.disconnect();
    if (this.active === tone) this.active = null;
    tone.onEnd?.();
    tone.onEnd = undefined;
  }
}
