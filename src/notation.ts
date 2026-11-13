// Written pitch spelling and notation rules. Pure data and functions: no DOM, no audio.
// Written spelling (step + accidental + octave) is kept separate from detected frequency;
// frequency is always derived from the spelling and the A4 reference.

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = 'bb' | 'b' | 'n' | '#' | '##';
export type Duration = 'w' | 'h';
export type KeySignature = 'C' | 'G' | 'D';

export interface WrittenPitch { step: Step; accidental?: Accidental; octave: number }

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_SEMITONES: Record<Accidental, number> = { bb: -2, b: -1, n: 0, '#': 1, '##': 2 };
const ACCIDENTAL_GLYPHS: Record<Accidental, string> = { bb: '𝄫', b: '♭', n: '♮', '#': '♯', '##': '𝄪' };

/** Quarter-note beats per duration (4/4: the quarter note gets the beat). */
export const DURATION_BEATS: Record<Duration, number> = { w: 4, h: 2 };
export const DURATION_NAMES: Record<Duration, string> = { w: 'whole note', h: 'half note' };

/** Sharps or flats implied by each supported key signature, by step. */
export const KEY_SIGNATURES: Record<KeySignature, Partial<Record<Step, Accidental>>> = {
  C: {},
  G: { F: '#' },
  D: { F: '#', C: '#' },
};
export const KEY_NAMES: Record<KeySignature, string> = { C: 'C major (no sharps or flats)', G: 'G major (one sharp: F♯)', D: 'D major (two sharps: F♯, C♯)' };

/** MIDI number of a written pitch. B♯3 and C4 share 60; spelling is preserved elsewhere. */
export function midiOf(pitch: WrittenPitch): number {
  return 12 * (pitch.octave + 1) + STEP_SEMITONES[pitch.step] + ACCIDENTAL_SEMITONES[pitch.accidental ?? 'n'];
}

/** Equal-tempered frequency of a written pitch relative to the A4 reference. */
export function frequencyOf(pitch: WrittenPitch, a4 = 440): number {
  return a4 * 2 ** ((midiOf(pitch) - 69) / 12);
}

/** Human-readable spelling such as "F♯4" or "B♭3" (naturals are not shown). */
export function spell(pitch: WrittenPitch): string {
  const accidental = pitch.accidental && pitch.accidental !== 'n' ? ACCIDENTAL_GLYPHS[pitch.accidental] : '';
  return `${pitch.step}${accidental}${pitch.octave}`;
}

/** VexFlow key such as "f#/4". The accidental glyph is added separately when required. */
export function vexKey(pitch: WrittenPitch): string {
  const accidental = pitch.accidental && pitch.accidental !== 'n' ? pitch.accidental : '';
  return `${pitch.step.toLowerCase()}${accidental}/${pitch.octave}`;
}

/**
 * Which accidental glyph must be printed before each note of a measure, following
 * conventional rules: the key signature applies to every octave; an accidental lasts
 * until the barline for that step and octave; a note that differs from what is
 * currently in force needs its accidental (including a natural to cancel).
 */
export function accidentalsForMeasure(measure: WrittenPitch[], key: KeySignature): (Accidental | null)[] {
  const inForce = new Map<string, Accidental>();
  return measure.map(pitch => {
    const slot = `${pitch.step}${pitch.octave}`;
    const current = inForce.get(slot) ?? KEY_SIGNATURES[key][pitch.step] ?? 'n';
    const written = pitch.accidental ?? 'n';
    if (written === current) return null;
    inForce.set(slot, written);
    return written;
  });
}

export function accidentalGlyph(accidental: Accidental): string { return ACCIDENTAL_GLYPHS[accidental]; }
