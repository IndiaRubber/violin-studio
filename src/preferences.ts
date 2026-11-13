import type { PracticeMode } from './practice-session';
import { clampTempo } from './tempo';

/** always = names under every note; after = revealed once each note is played; off = read the staff. */
export type NameHints = 'always' | 'after' | 'off';

export interface PracticePreferences {
  mode: PracticeMode;
  names: NameHints;
  /** Tempo chosen per exercise id; absent means the exercise's recommended tempo. */
  tempos: Record<string, number>;
  /** Fingering-hint choice per exercise id; absent means the exercise default. */
  fingering: Record<string, boolean>;
}
const KEY = 'violin-studio-practice';
export const DEFAULT_PREFERENCES: PracticePreferences = { mode: 'sustain', names: 'always', tempos: {}, fingering: {} };

function record<T>(value: unknown, valid: (v: unknown) => v is T): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, T] => valid(entry[1])));
}

export function loadPreferences(): PracticePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    if (!stored || typeof stored !== 'object') return DEFAULT_PREFERENCES;
    const names: NameHints = stored.names === 'after' || stored.names === 'off' || stored.names === 'always' ? stored.names
      : stored.showHints === false ? 'off' : 'always'; // Milestone 2A stored a boolean
    const tempos = Object.fromEntries(Object.entries(record(stored.tempos, (v): v is number => typeof v === 'number' && Number.isFinite(v))).map(([id, bpm]) => [id, clampTempo(bpm)]));
    // Milestone 2A stored a single tempo for the open-strings exercise.
    if (typeof stored.tempo === 'number' && tempos['open-strings'] === undefined) tempos['open-strings'] = clampTempo(stored.tempo);
    return { mode: stored.mode === 'quick' ? 'quick' : 'sustain', names, tempos, fingering: record(stored.fingering, (v): v is boolean => typeof v === 'boolean') };
  } catch { return DEFAULT_PREFERENCES; }
}
export function savePreferences(value: PracticePreferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private storage unavailable */ }
}
