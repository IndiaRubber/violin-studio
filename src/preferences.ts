import type { PracticeMode } from './practice-session';
import { clampTempo, DEFAULT_BPM } from './tempo';

export interface PracticePreferences { mode: PracticeMode; tempo: number; showHints: boolean }
const KEY = 'violin-studio-practice';
export const DEFAULT_PREFERENCES: PracticePreferences = { mode: 'sustain', tempo: DEFAULT_BPM, showHints: true };

export function loadPreferences(): PracticePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PracticePreferences> | null;
    if (!stored || typeof stored !== 'object') return DEFAULT_PREFERENCES;
    return {
      mode: stored.mode === 'quick' ? 'quick' : 'sustain',
      tempo: clampTempo(Number(stored.tempo ?? DEFAULT_BPM)),
      showHints: stored.showHints !== false,
    };
  } catch { return DEFAULT_PREFERENCES; }
}
export function savePreferences(value: PracticePreferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private storage unavailable */ }
}
