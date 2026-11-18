import { PRACTICE } from './config';
import { frequencyOf, spell, vexKey, type WrittenPitch } from './notation';
import type { PracticeNote, ViolinString } from './music';

export type FingerRow = 'open' | 'one' | 'low2' | 'high2' | 'three' | 'four';
export type FingerboardMode = 'walk' | 'find' | 'staff';
export interface Position { id: string; string: ViolinString; row: FingerRow; finger: 0 | 1 | 2 | 3 | 4; pitch: WrittenPitch }
export const STRINGS: ViolinString[] = ['G', 'D', 'A', 'E'];
export const ROWS: FingerRow[] = ['open', 'one', 'low2', 'high2', 'three', 'four'];
export const ROW_LABELS: Record<FingerRow, string> = { open: 'Open · 0', one: 'Finger 1', low2: 'Low 2 ↓', high2: 'High 2 ↑', three: 'Finger 3', four: 'Finger 4' };
const pitch = (step: WrittenPitch['step'], octave: number, accidental?: WrittenPitch['accidental']): WrittenPitch => ({ step, octave, accidental });
const columns: Record<ViolinString, WrittenPitch[]> = {
  G: [pitch('G', 3), pitch('A', 3), pitch('B', 3, 'b'), pitch('B', 3), pitch('C', 4), pitch('D', 4)],
  D: [pitch('D', 4), pitch('E', 4), pitch('F', 4), pitch('F', 4, '#'), pitch('G', 4), pitch('A', 4)],
  A: [pitch('A', 4), pitch('B', 4), pitch('C', 5), pitch('C', 5, '#'), pitch('D', 5), pitch('E', 5)],
  E: [pitch('E', 5), pitch('F', 5, '#'), pitch('G', 5), pitch('G', 5, '#'), pitch('A', 5), pitch('B', 5)],
};
export const POSITIONS: Position[] = STRINGS.flatMap(string => ROWS.map((row, index) => ({ id: `${string}-${row}`, string, row, finger: ([0, 1, 2, 2, 3, 4] as const)[index], pitch: columns[string][index] })));
export const position = (string: ViolinString, row: FingerRow): Position => POSITIONS.find(p => p.string === string && p.row === row)!;
export const positionHz = (p: Position, a4 = 440) => frequencyOf(p.pitch, a4);
export const supported = (p: Position, a4 = 440) => positionHz(p, a4) >= PRACTICE.minFrequency && positionHz(p, a4) <= PRACTICE.maxFrequency;
export const fingerLabel = (p: Position) => p.row === 'open' ? 'open string' : p.row === 'low2' ? 'low finger 2' : p.row === 'high2' ? 'high finger 2' : `finger ${p.finger}`;
export const asPracticeNote = (p: Position, a4 = 440, index = 0): PracticeNote => ({ id: `${p.id}-${index}`, name: spell(p.pitch), frequency: positionHz(p, a4), vexKey: vexKey(p.pitch), fingering: { string: p.string, finger: p.finger, high: p.row === 'high2' }, measure: index, duration: 'w', beats: 4, accidental: p.pitch.accidental === 'b' || p.pitch.accidental === '#' ? p.pitch.accidental : null });
export function walk(string: ViolinString, second: 'low2' | 'high2'): Position[] {
  const up = (['open', 'one', second, 'three', 'four'] as FingerRow[]).map(row => position(string, row));
  return [...up, ...up.slice(0, -1).reverse()];
}
export const combinedSequence = (): Position[] => [position('D', 'open'), position('D', 'one'), position('D', 'high2'), position('D', 'three'), position('A', 'open'), position('A', 'one'), position('A', 'high2'), position('A', 'three')];
/** Pure seeded shuffle for reproducible tests; avoid a repeated target at a cycle boundary. */
export function shuffled(pool: Position[], seed: number, previousId?: string): Position[] {
  const result = [...pool]; let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; const j = state % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  if (result.length > 1 && result[0].id === previousId) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
export const staffSequence = combinedSequence;
