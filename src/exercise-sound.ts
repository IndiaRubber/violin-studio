import type { PracticeNote } from './music';
import { frequencyToNote } from './music';
import { ReferenceTonePlayer } from './tone';
import { VIOLIN_SAMPLES, ViolinSamplePlayer, type SampleId } from './violin-samples';

export type ExerciseSound = 'tone' | 'violin';
const KEY = 'violin-studio-exercise-sound'; // deliberately separate from the tuner's preference
export function loadExerciseSound(): ExerciseSound {
  try { return localStorage.getItem(KEY) === 'violin' ? 'violin' : 'tone'; } catch { return 'tone'; }
}
export function saveExerciseSound(sound: ExerciseSound) {
  try { localStorage.setItem(KEY, sound); } catch { /* storage can be unavailable */ }
}

/** Never borrow a recording from another string, even when the written pitch is identical. */
export function sampleForPracticeNote(note: PracticeNote, a4: number): SampleId | null {
  const fingering = note.fingering;
  if (!fingering) return null;
  const pitch = frequencyToNote(note.frequency, a4);
  if (fingering.finger === 0) {
    const open = { G: 'g3', D: 'd4', A: 'a4', E: 'e5' } as const;
    const id = open[fingering.string];
    return pitch?.toLowerCase() === id && id in VIOLIN_SAMPLES ? id : null;
  }
  const fingered: Record<string, SampleId> = {
    'D:E4': 'd-e4', 'D:F4': 'd-f4', 'D:F♯4': 'd-fs4', 'D:G4': 'd-g4', 'D:A4': 'd-a4',
    'A:B4': 'a-b4', 'A:C5': 'a-c5', 'A:C♯5': 'a-cs5', 'A:D5': 'a-d5',
  };
  return fingered[`${fingering.string}:${pitch}`] ?? null;
}

type ToneLike = Pick<ReferenceTonePlayer, 'play' | 'dispose'>;
type SampleLike = Pick<ViolinSamplePlayer, 'play' | 'dispose'>;
export type PlaybackPhase = 'loading' | 'tone' | 'violin' | 'ended';
export type PlaybackUpdate = (phase: PlaybackPhase, reason?: string) => void;

/** One output-only reference player shared by lessons and the fingerboard trainer. */
export class ExerciseReferencePlayback {
  private token = 0;
  private tone: ToneLike | null = null;
  private sample: SampleLike | null = null;
  private active = false;
  constructor(private makeTone: () => ToneLike = () => new ReferenceTonePlayer(), private makeSample: () => SampleLike = () => new ViolinSamplePlayer(), private loadTimeoutMs = 5000) {}
  get playing() { return this.active; }
  stop() {
    this.token++; this.active = false;
    this.tone?.dispose(); this.tone = null;
    this.sample?.dispose(); this.sample = null;
  }
  async play(note: PracticeNote, a4: number, sound: ExerciseSound, update: PlaybackUpdate, failed: (error: unknown) => void) {
    this.stop();
    const token = ++this.token;
    this.active = true;
    const valid = () => token === this.token;
    const ended = () => { if (!valid()) return; this.active = false; update('ended'); };
    const tone = async (reason?: string) => {
      if (!valid()) return;
      update('tone', reason);
      this.tone = this.makeTone();
      try { await this.tone.play(note.frequency, ended); }
      catch (error) { if (valid()) { this.stop(); failed(error); } }
    };
    const id = sound === 'violin' ? sampleForPracticeNote(note, a4) : null;
    if (!id) { await tone(sound === 'violin' ? 'No recording for this string and note. Tone is playing.' : undefined); return; }
    update('loading');
    this.sample = this.makeSample();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const duration = await Promise.race([
        this.sample.play(id, note.frequency, ended),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Violin recording timed out.')), this.loadTimeoutMs); }),
      ]);
      if (valid() && this.active && duration > 0) update('violin');
    } catch (error) {
      if (!valid()) return;
      this.sample.dispose(); this.sample = null;
      await tone('Violin recording unavailable. Tone is playing.');
    } finally { if (timeout) clearTimeout(timeout); }
  }
}
