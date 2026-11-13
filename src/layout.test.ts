import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minMeasureWidth, pageOf, paginate } from './layout';
import { loadPreferences, savePreferences } from './preferences';

const header = (page: number) => (page === 0 ? 98 : 72); // clef + D major key (+ 4/4 on page 1)

describe('measure paging', () => {
  it('keeps all four open-string measures on one page at phone width', () => {
    expect(paginate([1, 1, 1, 1], 318, page => (page === 0 ? 76 : 50))).toEqual([{ first: 0, last: 3 }]);
  });
  it('splits an 8-measure half-note scale into readable windows on a 360 px phone', () => {
    const pages = paginate([2, 2, 2, 2, 2, 2, 2, 1], 330, header);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(p => Array.from({ length: p.last - p.first + 1 }, (_, i) => p.first + i))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    pages.forEach(page => expect(page.last).toBeGreaterThanOrEqual(page.first));
    // Measures are never squeezed below their readable width.
    pages.forEach((page, i) => {
      let used = header(i);
      for (let m = page.first; m <= page.last; m++) used += minMeasureWidth(m === 7 ? 1 : 2);
      expect(used).toBeLessThanOrEqual(330);
    });
  });
  it('shows a whole scale on one page on a wide screen', () => {
    expect(paginate([2, 2, 2, 2, 2, 2, 2, 1], 1200, header)).toEqual([{ first: 0, last: 7 }]);
  });
  it('always places at least one measure per page, even if very narrow', () => {
    expect(paginate([2, 2], 50, header)).toEqual([{ first: 0, last: 0 }, { first: 1, last: 1 }]);
  });
  it('finds the page holding the current measure', () => {
    const pages = [{ first: 0, last: 1 }, { first: 2, last: 4 }, { first: 5, last: 7 }];
    expect([0, 1, 2, 4, 5, 7].map(m => pageOf(pages, m))).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('practice preferences', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  });
  it('migrates Milestone 2A settings', () => {
    localStorage.setItem('violin-studio-practice', JSON.stringify({ mode: 'quick', tempo: 72, showHints: false }));
    expect(loadPreferences()).toEqual({ mode: 'quick', names: 'off', tempos: { 'open-strings': 72 }, fingering: {} });
  });
  it('round-trips per-exercise tempo and fingering choices, clamping bad values', () => {
    savePreferences({ mode: 'sustain', names: 'after', tempos: { 'd-major-scale': 90 }, fingering: { 'open-strings': false } });
    expect(loadPreferences()).toEqual({ mode: 'sustain', names: 'after', tempos: { 'd-major-scale': 90 }, fingering: { 'open-strings': false } });
    localStorage.setItem('violin-studio-practice', JSON.stringify({ tempos: { a: 500, b: 'x' }, fingering: { c: 'yes' }, names: 'loud' }));
    expect(loadPreferences()).toEqual({ mode: 'sustain', names: 'always', tempos: { a: 120 }, fingering: {} });
  });
});
