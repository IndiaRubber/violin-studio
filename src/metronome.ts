import { beatMs } from './tempo';

const LOOK_AHEAD_MS = 110;
const POLL_MS = 25;
const FIRST_BEAT_MS = 60;
const PULSE_MS = 140;
const CLICK_SECONDS = 0.024;

interface ClickOutput {
  ready(): Promise<void>;
  schedule(delayMs: number): void;
  cancel(): void;
  close(): void;
}

/** Quiet, unpitched noise with a fast decay, rather than a reference-like note. */
export function clickSamples(rate: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(rate * CLICK_SECONDS));
  let seed = 8437, previous = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const next = seed / 0x1_0000_0000 * 2 - 1;
    const attack = Math.min(1, i / (rate * 0.0015));
    const decay = (1 - i / (samples.length - 1)) ** 3;
    samples[i] = (next - previous) * attack * decay * 0.095;
    previous = next;
  }
  return samples;
}

function createClickOutput(): ClickOutput {
  const context = new AudioContext();
  const samples = clickSamples(context.sampleRate);
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples, 0);
  const clicks = new Set<AudioBufferSourceNode>();
  const disconnect = (click: AudioBufferSourceNode) => {
    clicks.delete(click);
    click.onended = null;
    click.disconnect();
  };
  const cancel = () => {
    for (const click of clicks) {
      try { click.stop(); } catch { /* already ended */ }
      disconnect(click);
    }
  };
  return {
    ready: () => context.resume(),
    schedule: delayMs => {
      if (context.state !== 'running') return;
      const click = context.createBufferSource();
      click.buffer = buffer;
      click.connect(context.destination);
      clicks.add(click);
      click.onended = () => disconnect(click);
      click.start(context.currentTime + delayMs / 1000);
    },
    cancel,
    close: () => { cancel(); if (context.state !== 'closed') void context.close().catch(() => {}); },
  };
}

/** The visual pulse and scheduled clicks share one absolute beat grid. No microphone dependency. */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | undefined;
  private output: ClickOutput | undefined;
  private audioReady = false;
  private audible = false;
  private blocked = false;
  private period = beatMs(60);
  private first = 0;
  private nextSound = 0;
  private pulse = false;

  constructor(private onPulse: (pulse: boolean) => void, private onAudioError: () => void,
    private now = () => performance.now(), private makeOutput = createClickOutput) {}

  start(bpm: number, audible: boolean) {
    this.stop();
    this.period = beatMs(bpm);
    this.align();
    this.timer = setInterval(this.tick, POLL_MS);
    this.setAudible(audible);
  }

  stop() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.audible = false;
    this.releaseAudio();
    this.showPulse(false);
  }

  setTempo(bpm: number) {
    const next = beatMs(bpm);
    if (next === this.period) return;
    this.period = next;
    if (this.timer !== undefined) {
      this.output?.cancel();
      this.align();
      this.showPulse(false);
    }
  }

  setBlocked(blocked: boolean) {
    this.blocked = blocked;
    if (blocked) this.output?.cancel();
  }

  setAudible(audible: boolean) {
    if (this.timer === undefined || audible === this.audible) return;
    this.audible = audible;
    if (!audible) { this.releaseAudio(); return; }
    try {
      const output = this.makeOutput();
      this.output = output;
      void output.ready().then(() => {
        if (this.output === output) { this.audioReady = true; this.tick(); }
      }).catch(() => { if (this.output === output) this.failAudio(); });
    } catch { this.failAudio(); }
  }

  private align() {
    this.first = this.now() + FIRST_BEAT_MS;
    this.nextSound = this.first;
  }

  private showPulse(pulse: boolean) {
    if (pulse === this.pulse) return;
    this.pulse = pulse;
    this.onPulse(pulse);
  }

  private tick = () => {
    const now = this.now(), elapsed = now - this.first;
    this.showPulse(elapsed >= 0 && elapsed % this.period < PULSE_MS);
    if (!this.audioReady || this.blocked || !this.output) return;
    // Drop missed beats after a stall instead of emitting a burst of late clicks.
    if (this.nextSound < now) this.nextSound += Math.ceil((now - this.nextSound) / this.period) * this.period;
    const delay = this.nextSound - now;
    if (delay > LOOK_AHEAD_MS) return;
    this.nextSound += this.period;
    try { this.output.schedule(delay); } catch { this.failAudio(); }
  };

  private releaseAudio() {
    const output = this.output;
    this.output = undefined;
    this.audioReady = false;
    output?.close();
  }

  private failAudio() {
    this.audible = false;
    this.releaseAudio();
    this.onAudioError();
  }
}
