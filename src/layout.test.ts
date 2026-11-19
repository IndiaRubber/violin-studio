import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectWindow, scoreTrack, trackOffset, TRACK_MEASURE_PX, TRACK_PLAYHEAD_X } from './layout';
import { loadPreferences, savePreferences } from './preferences';

describe('practice score track', () => {
  it('places equally timed onsets at equal distances even across measures', () => {
    const track = scoreTrack([{ measure: 0, duration: 'h' }, { measure: 0, duration: 'h' },
      { measure: 1, duration: 'h' }, { measure: 1, duration: 'h' }, { measure: 2, duration: 'w' }]);
    const positions = track.slots.map(slot => slot.x);
    expect(positions).toEqual([42, 98, 154, 210, 266]);
    expect(track.slots.map(slot => slot.holdEnd - slot.x)).toEqual([48, 48, 48, 48, 104]);
    expect(track.slots.at(-1)!.holdEnd).toBeLessThan(track.width);
  });
  it('gives whole notes double the distance of half notes and anchors the last one', () => {
    const track = scoreTrack([{ duration: 'w' }, { measure: 1, duration: 'h' }, { measure: 1, duration: 'h' }]);
    expect(track.slots.map(slot => slot.x)).toEqual([42, 154, 210]);
    for (const slot of track.slots) expect(slot.x - trackOffset(slot.x)).toBe(TRACK_PLAYHEAD_X);
    expect(trackOffset(undefined)).toBe(0);
  });
  it('allows inspection without stretching the last or narrowest window', () => {
    expect(inspectWindow(5, 2 * TRACK_MEASURE_PX, 2)).toEqual({ first: 2, last: 3, length: 2 });
    expect(inspectWindow(5, 2 * TRACK_MEASURE_PX, 10)).toEqual({ first: 4, last: 4, length: 2 });
    expect(inspectWindow(5, 95, 0)).toEqual({ first: 0, last: 0, length: 1 });
  });
});

describe('practice preferences', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  });
  it('migrates Milestone 2A settings', () => {
    localStorage.setItem('violin-studio-practice', JSON.stringify({ mode: 'quick', tempo: 72, showHints: false }));
    expect(loadPreferences()).toEqual({ mode: 'quick', names: 'off', tempos: { 'open-strings': 72 }, fingering: {}, patterns: {} });
  });
  it('round-trips per-exercise tempo and fingering choices, clamping bad values', () => {
    savePreferences({ mode: 'sustain', names: 'after', tempos: { 'd-major-scale': 90 }, fingering: { 'open-strings': false }, patterns: { 'd-major-scale': true } });
    expect(loadPreferences()).toEqual({ mode: 'sustain', names: 'after', tempos: { 'd-major-scale': 90 }, fingering: { 'open-strings': false }, patterns: { 'd-major-scale': true } });
    localStorage.setItem('violin-studio-practice', JSON.stringify({ tempos: { a: 500, b: 'x' }, fingering: { c: 'yes' }, names: 'loud' }));
    expect(loadPreferences()).toEqual({ mode: 'sustain', names: 'always', tempos: { a: 120 }, fingering: {}, patterns: {} });
  });
});
