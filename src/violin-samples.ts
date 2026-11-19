/** Four edited Iowa bowed open-string excerpts. See VIOLIN_SAMPLES.md for source and measurements. */
export const VIOLIN_SAMPLES = {
  g3: { url: '/samples/g3.wav', measuredHz: 195.61 },
  d4: { url: '/samples/d4.wav', measuredHz: 291.51 },
  a4: { url: '/samples/a4.wav', measuredHz: 438.18 },
  e5: { url: '/samples/e5.wav', measuredHz: 659.11 },
} as const;

/** Short, separately measured stopped-string excerpts. IDs preserve physical string identity. */
export const FINGERED_VIOLIN_SAMPLES = {
  'd-e4': { url: '/samples/d-e4.wav', measuredHz: 323.52 },
  'd-f4': { url: '/samples/d-f4.wav', measuredHz: 353.46 },
  'd-fs4': { url: '/samples/d-fs4.wav', measuredHz: 371.53 },
  'd-g4': { url: '/samples/d-g4.wav', measuredHz: 388.03 },
  'd-a4': { url: '/samples/d-a4.wav', measuredHz: 435.87 },
  'a-b4': { url: '/samples/a-b4.wav', measuredHz: 487.39 },
  'a-c5': { url: '/samples/a-c5.wav', measuredHz: 512.65 },
  'a-cs5': { url: '/samples/a-cs5.wav', measuredHz: 565.93 },
  'a-d5': { url: '/samples/a-d5.wav', measuredHz: 581.81 },
} as const;
export const SAMPLE_CATALOG = { ...VIOLIN_SAMPLES, ...FINGERED_VIOLIN_SAMPLES };
export type SampleId = keyof typeof SAMPLE_CATALOG;

export type OpenStringId = keyof typeof VIOLIN_SAMPLES;
export type TunerSound = 'tone' | 'violin';
const SOUND_KEY = 'violin-studio-tuner-sound';

export function sampleForString(id: string) { return Object.prototype.hasOwnProperty.call(VIOLIN_SAMPLES, id) ? VIOLIN_SAMPLES[id as OpenStringId] : null; }
export function playbackRate(targetHz: number, measuredHz: number) {
  if (!Number.isFinite(targetHz) || !Number.isFinite(measuredHz) || targetHz <= 0 || measuredHz <= 0) throw new Error('Invalid sample pitch.');
  return targetHz / measuredHz;
}
export function loadTunerSound(): TunerSound {
  try { return localStorage.getItem(SOUND_KEY) === 'violin' ? 'violin' : 'tone'; } catch { return 'tone'; }
}
export function saveTunerSound(sound: TunerSound) {
  try { localStorage.setItem(SOUND_KEY, sound); } catch { /* private browsing can reject storage */ }
}

type SampleContext = Pick<AudioContext, 'state' | 'currentTime' | 'destination' | 'resume' | 'close' | 'decodeAudioData' | 'createBufferSource' | 'createGain'>;

/** Output-only player. The context starts inside Hear note's user gesture; fetch is abortable. */
export class ViolinSamplePlayer {
  private context: SampleContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(private createContext: () => SampleContext = () => new AudioContext(), private get: typeof fetch = (input, init) => fetch(input, init)) {}

  async play(id: SampleId, targetHz: number, onEnd: () => void): Promise<number> {
    this.dispose();
    const token = ++this.generation;
    const sample = SAMPLE_CATALOG[id];
    const rate = playbackRate(targetHz, sample.measuredHz);
    const context = this.createContext();
    this.context = context;
    this.controller = new AbortController();
    // Resume before awaiting the network so Android's user gesture permits audio.
    if (context.state === 'suspended') await context.resume();
    if (token !== this.generation) return 0;
    if (context.state !== 'running') throw new Error('Audio output is suspended.');
    const response = await this.get(sample.url, { signal: this.controller.signal });
    if (!response.ok) throw new Error(`Sample unavailable (${response.status}).`);
    const data = await response.arrayBuffer();
    if (token !== this.generation) return 0;
    const buffer = await context.decodeAudioData(data);
    if (token !== this.generation) return 0;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = 1;
    source.connect(gain).connect(context.destination);
    source.onended = () => {
      if (token !== this.generation) return;
      source.disconnect(); gain.disconnect();
      this.source = null; this.gain = null;
      onEnd();
    };
    this.source = source; this.gain = gain;
    source.start();
    return buffer.duration / rate * 1000;
  }

  dispose() {
    this.generation++;
    this.controller?.abort(); this.controller = null;
    if (this.source) {
      this.source.onended = null;
      const now = this.context?.currentTime ?? 0;
      this.gain?.gain.setTargetAtTime(0, now, 0.01);
      try { this.source.stop(now + 0.04); } catch { /* already stopped */ }
      this.source.disconnect(); this.gain?.disconnect();
    }
    this.source = null; this.gain = null;
    const context = this.context; this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
