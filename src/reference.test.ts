import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReference, saveReference, scaledNotes, validReference } from './reference';
import { OPEN_STRINGS, frequencyToNote } from './music';
import { ExerciseEngine } from './exercise';
import type { PitchReading } from './pitch';

afterEach(() => vi.unstubAllGlobals());
describe('shared A4 reference', () => {
  it('scales practice and tuner targets at the supported references', () => {
    for (const a4 of [415, 432, 440, 442, 466]) {
      const notes = scaledNotes(OPEN_STRINGS, a4);
      expect(notes[2].frequency).toBe(a4);
      expect(notes.map(note => frequencyToNote(note.frequency, a4))).toEqual(['G3', 'D4', 'A4', 'E5']);
      const engine = new ExerciseEngine(notes);
      const reading: PitchReading = { rawHz: notes[0].frequency, smoothHz: notes[0].frequency, clarity: 0.98, rms: 0.1, note: 'G3', reason: 'ok' };
      for (let t = 0; t <= 350; t += 50) engine.evaluate(reading, t);
      expect(engine.index).toBe(1);
    }
  });
  it('persists valid values and defaults invalid storage to 440', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(loadReference()).toBe(440);
    for (const a4 of [415, 432, 440, 442, 466]) { saveReference(a4); expect(loadReference()).toBe(a4); }
    expect(validReference(414)).toBe(false);
    saveReference(500);
    expect(loadReference()).toBe(466);
  });
});
