import { REFERENCE_TONE } from './config';
import { ReferenceTonePlayer } from './tone';

export const PATTERN_TONE = { ...REFERENCE_TONE, durationMs: 520, attackMs: 35, releaseMs: 110 };
export const PATTERN_GAP_MS = 130;
/** Includes the complete note sequence, inter-note silences, settling, and scheduling margin. */
export const patternDemoMs = (count: number) => count * PATTERN_TONE.durationMs + Math.max(0, count - 1) * PATTERN_GAP_MS + REFERENCE_TONE.settleMs + 150;

type TonePlayer = Pick<ReferenceTonePlayer, 'play' | 'dispose'>;

/** Sequentially plays an original note group through the existing tone synthesis. */
export class PatternDemo {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private active = false;
  constructor(private player: TonePlayer = new ReferenceTonePlayer(undefined, PATTERN_TONE)) {}

  get playing() { return this.active; }

  start(frequencies: number[], onDone: () => void, onError: () => void) {
    if (!frequencies.length) throw new Error('A pattern needs at least one note.');
    this.stop();
    const generation = ++this.generation;
    this.active = true;
    const step = (index: number) => {
      if (generation !== this.generation) return;
      void this.player.play(frequencies[index], () => {
        if (generation !== this.generation) return;
        if (index === frequencies.length - 1) { this.active = false; onDone(); }
        else this.timer = setTimeout(() => step(index + 1), PATTERN_GAP_MS);
      }).catch(() => { if (generation === this.generation) { this.stop(); onError(); } });
    };
    step(0);
  }

  stop() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.active = false;
    // Disposing invalidates a pending AudioContext.resume as well as a sounding
    // tone, so a cancelled demo cannot begin after navigation or restart.
    this.player.dispose();
  }

  dispose() { this.stop(); }
}
