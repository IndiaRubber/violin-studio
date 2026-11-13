import { describe, expect, it } from 'vitest';
import { beatMs, beatPosition, clampTempo, DEFAULT_BPM, MAX_BPM, MIN_BPM, wholeNoteMs } from './tempo';

describe('tempo and whole-note duration', () => {
  it('derives whole-note duration as 240 / BPM seconds', () => {
    expect(wholeNoteMs(40)).toBe(6000);
    expect(wholeNoteMs(60)).toBe(4000);
    expect(wholeNoteMs(80)).toBe(3000);
    expect(wholeNoteMs(120)).toBe(2000);
    for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) expect(wholeNoteMs(bpm)).toBeCloseTo(240_000 / bpm, 6);
  });
  it('uses one quarter-note beat per 60 / BPM seconds', () => {
    expect(beatMs(60)).toBe(1000);
    expect(beatMs(120)).toBe(500);
  });
  it('clamps tempo to 40–120 BPM and defaults invalid input to 60', () => {
    expect(DEFAULT_BPM).toBe(60);
    expect(clampTempo(10)).toBe(40);
    expect(clampTempo(300)).toBe(120);
    expect(clampTempo(72.4)).toBe(72);
    expect(clampTempo(Number.NaN)).toBe(60);
  });
  it('reports the current beat and progress within a whole note', () => {
    expect(beatPosition(-1, 60)).toEqual({ beat: 0, progress: 0 });
    expect(beatPosition(0, 60)).toEqual({ beat: 1, progress: 0 });
    expect(beatPosition(999, 60).beat).toBe(1);
    expect(beatPosition(1000, 60).beat).toBe(2);
    expect(beatPosition(3500, 60)).toEqual({ beat: 4, progress: 0.875 });
    expect(beatPosition(9000, 60)).toEqual({ beat: 4, progress: 1 });
    expect(beatPosition(1500, 120)).toEqual({ beat: 4, progress: 0.75 });
  });
});
