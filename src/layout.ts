// Pure measure-paging for the staff. Narrow screens show a readable window of whole
// measures (like turning pages) instead of shrinking a long exercise to fit.

/** Minimum readable width of a measure body, by number of notes it holds. */
export function minMeasureWidth(notesInMeasure: number): number {
  return notesInMeasure <= 1 ? 58 : 24 + 40 * notesInMeasure;
}

export interface Page { first: number; last: number }

/**
 * Greedily packs measures into pages. `headerWidth(pageIndex)` is the clef/key/time
 * signature width at the start of each page (the time signature is on page 1 only).
 * Every page holds at least one measure.
 */
export function paginate(noteCounts: number[], available: number, headerWidth: (page: number) => number): Page[] {
  const pages: Page[] = [];
  let first = 0;
  while (first < noteCounts.length) {
    let used = headerWidth(pages.length);
    let last = first;
    used += minMeasureWidth(noteCounts[first]);
    while (last + 1 < noteCounts.length && used + minMeasureWidth(noteCounts[last + 1]) <= available) {
      last++;
      used += minMeasureWidth(noteCounts[last]);
    }
    pages.push({ first, last });
    first = last + 1;
  }
  return pages;
}

export function pageOf(pages: Page[], measure: number): number {
  const index = pages.findIndex(page => measure >= page.first && measure <= page.last);
  return index < 0 ? 0 : index;
}
