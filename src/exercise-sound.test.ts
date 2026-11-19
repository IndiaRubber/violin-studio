import { afterEach, describe, expect, it, vi } from 'vitest';
import { findExercise, practiceNotes } from './curriculum';
import { asPracticeNote, position } from './fingerboard';
import { ExerciseReferencePlayback, loadExerciseSound, sampleForPracticeNote, saveExerciseSound } from './exercise-sound';
import { playbackRate, SAMPLE_CATALOG, loadTunerSound, saveTunerSound } from './violin-samples';

afterEach(() => vi.unstubAllGlobals());
describe('exercise violin references', () => {
  it('uses pitch and suggested string, so the two written A4s have different recordings', () => {
    for (const a4 of [440, 442]) {
      const notes = practiceNotes(findExercise('pattern-fourth-finger')!, a4);
      const fourth = notes.find(n => n.fingering?.string === 'D' && n.fingering.finger === 4)!;
      const open = notes.find(n => n.fingering?.string === 'A' && n.fingering.finger === 0)!;
      expect(sampleForPracticeNote(fourth, a4)).toBe('d-a4');
      expect(sampleForPracticeNote(open, a4)).toBe('a4');
      for (const note of [fourth, open]) {
        const id = sampleForPracticeNote(note, a4)!;
        expect(SAMPLE_CATALOG[id].measuredHz * playbackRate(note.frequency, SAMPLE_CATALOG[id].measuredHz)).toBeCloseTo(a4, 8);
      }
    }
  });
  it('covers the current D/A fingered tune notes without borrowing other-string clips', () => {
    for (const id of ['board-close-pair-d', 'board-low-second-turn', 'board-crossing-echoes']) {
      for (const a4 of [440, 442]) for (const note of practiceNotes(findExercise(id)!, a4)) {
        expect(sampleForPracticeNote(note, a4), `${id}: ${note.name} on ${note.fingering?.string}`).not.toBeNull();
      }
    }
    const expected = { 'D:E4': 'd-e4', 'D:F4': 'd-f4', 'D:F#4': 'd-fs4', 'D:G4': 'd-g4', 'D:A4': 'd-a4', 'A:B4': 'a-b4', 'A:C5': 'a-c5', 'A:C#5': 'a-cs5', 'A:D5': 'a-d5' };
    for (const a4 of [440, 442]) for (const [key, id] of Object.entries(expected)) {
      const [string, pitch] = key.split(':');
      const all = [...['board-close-pair-d', 'board-low-second-turn', 'board-crossing-echoes', 'pattern-move-one-finger', 'pattern-low-second-a', 'pattern-fourth-finger', 'd-major-scale'].flatMap(exerciseId => practiceNotes(findExercise(exerciseId)!, a4)), ...['D', 'A'].flatMap(s => ['one', 'low2', 'high2', 'three', 'four'].map(row => asPracticeNote(position(s as 'D' | 'A', row as 'one' | 'low2' | 'high2' | 'three' | 'four'), a4)))];
      const note = all.find(n => n.fingering?.string === string && n.name.replace('♯', '#') === pitch)!;
      expect(note, key).toBeDefined();
      expect(sampleForPracticeNote(note, a4), key).toBe(id);
    }
    expect(sampleForPracticeNote(asPracticeNote(position('G', 'one')), 440)).toBeNull();
    expect(sampleForPracticeNote(asPracticeNote(position('A', 'four')), 440)).toBeNull();
    const noFingering = { ...asPracticeNote(position('D', 'four')), fingering: undefined };
    expect(sampleForPracticeNote(noFingering, 440)).toBeNull();
  });
  it('stores one shared exercise choice without changing the tuner choice', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(loadExerciseSound()).toBe('tone');
    saveExerciseSound('violin');
    expect(loadExerciseSound()).toBe('violin');
    expect(loadTunerSound()).toBe('tone');
    saveTunerSound('violin'); saveExerciseSound('tone');
    expect(loadTunerSound()).toBe('violin');
  });
  it('falls back visibly for missing or failed samples, and ignores a cancelled load', async () => {
    const note = asPracticeNote(position('G', 'one'));
    const tone = { play: vi.fn(async () => 1600), dispose: vi.fn() };
    let rejectSample!: (error: Error) => void;
    const sample = { play: vi.fn(() => new Promise<number>((_, reject) => { rejectSample = reject; })), dispose: vi.fn() };
    const player = new ExerciseReferencePlayback(() => tone as never, () => sample as never);
    const update = vi.fn(), failed = vi.fn();
    await player.play(note, 440, 'violin', update, failed);
    expect(update).toHaveBeenCalledWith('tone', expect.stringContaining('No recording'));
    expect(tone.play).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    const d = asPracticeNote(position('D', 'one'));
    const loading = player.play(d, 440, 'violin', update, failed);
    expect(update).toHaveBeenCalledWith('loading');
    rejectSample(new Error('decode failed'));
    await loading;
    expect(update).toHaveBeenCalledWith('tone', expect.stringContaining('unavailable'));
    const cancelled = player.play(d, 440, 'violin', update, failed);
    player.stop();
    const before = tone.play.mock.calls.length;
    rejectSample(new Error('late failure'));
    await cancelled;
    expect(tone.play).toHaveBeenCalledTimes(before);
    expect(failed).not.toHaveBeenCalled();
  });
  it('bounds a stalled sample load and plays Tone', async () => {
    const tone = { play: vi.fn(async () => 1600), dispose: vi.fn() };
    const sample = { play: vi.fn(() => new Promise<number>(() => {})), dispose: vi.fn() };
    const player = new ExerciseReferencePlayback(() => tone as never, () => sample as never, 10);
    const update = vi.fn();
    await player.play(asPracticeNote(position('D', 'one')), 440, 'violin', update, vi.fn());
    expect(sample.dispose).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('tone', expect.stringContaining('unavailable'));
    expect(tone.play).toHaveBeenCalledOnce();
  });
});
