// The exercise library: structured data that drives notation, timing, and practice.
// All melodies are original. Frequencies are never stored; they are derived from spelling.

import { PRACTICE } from './config';
import { DURATION_BEATS, frequencyOf, midiOf, spell, vexKey, accidentalsForMeasure, KEY_SIGNATURES, type Accidental, type Duration, type KeySignature, type Step, type WrittenPitch } from './notation';
import type { Fingering, PracticeNote, ViolinString } from './music';
import { MAX_A4, MIN_A4 } from './reference';
import { MAX_BPM, MIN_BPM } from './tempo';

export const STRING_OPEN_MIDI: Record<ViolinString, number> = { G: 55, D: 62, A: 69, E: 76 };

export interface ExerciseNote { pitch: WrittenPitch; duration: Duration; fingering?: Fingering }
export interface TimeSignature { beats: number; beatValue: 4 }
export interface PatternGroup {
  /** Flat note indices, inclusive start and exclusive end; may cross barlines/pages. */
  start: number;
  end: number;
  title: string;
  cue: string;
  string: 'D' | 'A';
  closePair: '1–2' | '2–3';
  /** Notes sounded by Hear pattern, in staff order. */
  demo: number[];
}

export interface Exercise {
  id: string;
  number: string;
  title: string;
  description: string;
  objective: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  tempo: number;
  measures: ExerciseNote[][];
  instructions?: string[];
  /** Fingering hints are shown by default in early exercises; students can turn them off. */
  fingeringByDefault: boolean;
  /** Exercise 01 keeps its single-string focus practice. */
  stringFocus?: boolean;
  /** Optional teaching overlay. It never changes written notes or evaluation. */
  patterns?: PatternGroup[];
  patternChallenge?: boolean;
  patternQuestion?: string;
  patternHintsByDefault?: boolean;
}

// Token format: "F#4:h@D2^" = F♯4, half note, D string, 2nd finger, high.
const TOKEN = /^([A-G])(bb|b|n|##|#)?(\d):([wh])(?:@([GDAE])([0-4])(\^)?)?$/;
export function parseNote(token: string): ExerciseNote {
  const match = TOKEN.exec(token);
  if (!match) throw new Error(`Invalid note token "${token}".`);
  const [, step, accidental, octave, duration, string, finger, high] = match;
  return {
    pitch: { step: step as Step, ...(accidental ? { accidental: accidental as Accidental } : {}), octave: Number(octave) },
    duration: duration as Duration,
    ...(string ? { fingering: { string: string as ViolinString, finger: Number(finger) as Fingering['finger'], ...(high ? { high: true } : {}) } } : {}),
  };
}
const bars = (...measures: string[]) => measures.map(measure => measure.trim().split(/\s+/).map(parseNote));
const COMMON = { timeSignature: { beats: 4, beatValue: 4 } as TimeSignature };

export const EXERCISES: Exercise[] = [
  {
    id: 'open-strings', number: '01', title: 'Open Strings', difficulty: 1, keySignature: 'C', tempo: 60, ...COMMON,
    description: 'G, D, A, and E — the four open strings as whole notes.',
    objective: 'Find each open string and sustain it for four steady beats.',
    measures: bars('G3:w@G0', 'D4:w@D0', 'A4:w@A0', 'E5:w@E0'),
    instructions: ['Play each string without fingers.', 'Find the note first; the count starts once it is steady.'],
    fingeringByDefault: true, stringFocus: true,
  },
  {
    id: 'string-crossings', number: '02', title: 'String Crossings', difficulty: 1, keySignature: 'C', tempo: 60, ...COMMON,
    description: 'Half notes moving between neighbouring open strings.',
    objective: 'Read which string comes next and cross to it cleanly.',
    measures: bars('G3:h@G0 D4:h@D0', 'G3:h@G0 D4:h@D0', 'D4:h@D0 A4:h@A0', 'D4:h@D0 A4:h@A0', 'A4:h@A0 E5:h@E0', 'A4:h@A0 E5:h@E0', 'E5:h@E0 A4:h@A0', 'D4:h@D0 G3:h@G0'),
    instructions: ['Each half note lasts two beats.', 'Neighbouring strings only: G–D, D–A, A–E.'],
    fingeringByDefault: true,
  },
  {
    id: 'first-finger', number: '03', title: 'First Finger', difficulty: 2, keySignature: 'C', tempo: 60, ...COMMON,
    description: 'Open string to first finger and back, on the D and A strings.',
    objective: 'Place the first finger a whole step above the open string: D–E and A–B.',
    measures: bars('D4:h@D0 E4:h@D1', 'E4:h@D1 D4:h@D0', 'D4:h@D0 E4:h@D1', 'D4:w@D0', 'A4:h@A0 B4:h@A1', 'B4:h@A1 A4:h@A0', 'A4:h@A0 B4:h@A1', 'A4:w@A0'),
    instructions: ['When the same note repeats, lift the bow briefly between them.'],
    fingeringByDefault: true,
  },
  {
    id: 'd-string-walk', number: '04', title: 'D-String Walk', difficulty: 2, keySignature: 'C', tempo: 60, ...COMMON,
    description: 'D, E, F♯, G and back down, all on the D string.',
    objective: 'Add the high second finger (F♯) and third finger (G).',
    measures: bars('D4:h@D0 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'F#4:h@D2^ E4:h@D1', 'D4:w@D0'),
    instructions: ['The sharp sign (♯) raises F a half step to F♯.', '“High 2” sits close to the third finger.'],
    fingeringByDefault: true,
  },
  {
    id: 'a-string-walk', number: '05', title: 'A-String Walk', difficulty: 2, keySignature: 'C', tempo: 60, ...COMMON,
    description: 'A, B, C♯, D and back down, all on the A string.',
    objective: 'Use the same finger pattern as the D string: 0, 1, high 2, 3.',
    measures: bars('A4:h@A0 B4:h@A1', 'C#5:h@A2^ D5:h@A3', 'C#5:h@A2^ B4:h@A1', 'A4:w@A0'),
    instructions: ['C♯ uses a high second finger, just like F♯ on the D string.'],
    fingeringByDefault: true,
  },
  {
    id: 'pattern-move-one-finger', number: '05A', title: 'Move One Finger', difficulty: 2, keySignature: 'C', tempo: 72, ...COMMON,
    description: 'Compare high and low second finger on the D string.',
    objective: 'Keep E and G in place while F♯ changes to F natural. Hear each group, then play up and back.',
    measures: bars('E4:h@D1 F#4:h@D2^', 'G4:w@D3', 'F#4:h@D2^ E4:h@D1', 'E4:h@D1 Fn4:h@D2', 'G4:w@D3', 'Fn4:h@D2 E4:h@D1'),
    patterns: [
      { start: 0, end: 5, title: 'High second finger', cue: 'Fingers 2 and 3 close: F♯ to G is a half step.', string: 'D', closePair: '2–3', demo: [0, 1, 2] },
      { start: 5, end: 10, title: 'Low second finger', cue: 'Fingers 1 and 2 close: E to F is a half step.', string: 'D', closePair: '1–2', demo: [5, 6, 7] },
    ],
    instructions: ['The second finger moves; E and G stay the same.', 'A half step is the smaller gap. A whole step is twice that pitch distance.'],
    patternHintsByDefault: true, fingeringByDefault: true,
  },
  {
    id: 'pattern-move-shape', number: '05B', title: 'Move the Shape', difficulty: 2, keySignature: 'C', tempo: 72, ...COMMON,
    description: 'Carry open–1–high 2–3 from D to A.',
    objective: 'Read the same finger spacing on two strings: fingers 2 and 3 close.',
    measures: bars('D4:h@D0 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'A4:h@A0 B4:h@A1', 'C#5:h@A2^ D5:h@A3'),
    patterns: [
      { start: 0, end: 4, title: 'D string shape', cue: 'Open–1–high 2–3. Fingers 2 and 3 close.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3] },
      { start: 4, end: 8, title: 'A string shape', cue: 'The same spacing moves to A: open–1–high 2–3.', string: 'A', closePair: '2–3', demo: [4, 5, 6, 7] },
    ],
    instructions: ['The second group begins on the open A string.', 'Try the D Major Scale next to spot both groups again.'],
    patternHintsByDefault: true, fingeringByDefault: true,
  },
  {
    id: 'pattern-spot-phrase', number: '05C', title: 'Spot It Before You Play', difficulty: 3, keySignature: 'D', tempo: 72, ...COMMON,
    description: 'Find the close pair in a short Morning Steps excerpt.',
    objective: 'Look ahead at the staff. Which two notes form the half step?',
    // Original tune measures 2–4; the E–F♯–G phrase crosses measures 3–4 and a narrow page turn.
    measures: bars('F#4:h@D2^ D4:h@D0', 'E4:h@D1 F#4:h@D2^', 'G4:w@D3'),
    patterns: [{ start: 2, end: 5, title: 'Morning Steps, measures 3–4', cue: 'F♯ and G are the close pair: fingers 2 and 3.', string: 'D', closePair: '2–3', demo: [2, 3, 4] }],
    patternChallenge: true, patternHintsByDefault: false, fingeringByDefault: false,
  },
  {
    id: 'pattern-low-second-a', number: '05D', title: 'Low Second Finger on A', difficulty: 2, keySignature: 'C', tempo: 72, ...COMMON,
    description: 'Compare high and low second finger on the A string.',
    objective: 'Keep B and D in place while C♯ changes to C natural. Hear each group, then play up and back.',
    measures: bars('B4:h@A1 C#5:h@A2^', 'D5:w@A3', 'C#5:h@A2^ B4:h@A1', 'B4:h@A1 Cn5:h@A2', 'D5:w@A3', 'Cn5:h@A2 B4:h@A1'),
    patterns: [
      { start: 0, end: 5, title: 'High second finger', cue: 'Fingers 2 and 3 close: C♯ to D is a half step.', string: 'A', closePair: '2–3', demo: [0, 1, 2] },
      { start: 5, end: 10, title: 'Low second finger', cue: 'Fingers 1 and 2 close: B to C natural is a half step.', string: 'A', closePair: '1–2', demo: [5, 6, 7] },
    ],
    instructions: ['Only finger 2 moves; B and D stay in place.', 'The natural sign (♮) makes C natural clear after the C♯ group.'],
    patternHintsByDefault: true, fingeringByDefault: true,
  },
  {
    id: 'pattern-fourth-finger', number: '05E', title: 'Add the Fourth Finger', difficulty: 2, keySignature: 'C', tempo: 72, ...COMMON,
    description: 'Extend the D-string shape to fourth finger, then compare open A.',
    objective: 'Play E–F♯–G–A on D, then compare fourth-finger A with open A by ear.',
    measures: bars('E4:h@D1 F#4:h@D2^', 'G4:h@D3 A4:h@D4', 'A4:h@A0 G4:h@D3'),
    patterns: [{ start: 0, end: 6, title: 'D string through fourth finger', cue: 'Fingers 2 and 3 close. The two A4 notes suggest D string finger 4, then open A; both sound the same written pitch.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3, 4] }],
    instructions: ['The two A4 notes suggest different ways to play the same pitch. Lift or change sound between them; one continuous note cannot count twice.', 'The microphone checks pitch, not which string or finger made it.'],
    patternHintsByDefault: true, fingeringByDefault: true,
  },
  {
    id: 'pattern-crossing-change', number: '05F', title: 'Change Shape at the Crossing', difficulty: 3, keySignature: 'G', tempo: 72, ...COMMON,
    description: 'Change from high 2 on D to low 2 on A.',
    objective: 'Look ahead: the close pair changes as you cross from D to A.',
    measures: bars('D4:h@D0 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'A4:h@A0 B4:h@A1', 'Cn5:h@A2 D5:h@A3'),
    patterns: [
      { start: 0, end: 4, title: 'D string: high 2', cue: 'Fingers 2 and 3 close on D. Coming next on A: fingers 1 and 2 close.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3] },
      { start: 4, end: 8, title: 'A string: low 2 next', cue: 'Now fingers 1 and 2 close: B to C natural. This differs from Move the Shape.', string: 'A', closePair: '1–2', demo: [4, 5, 6, 7] },
    ],
    instructions: ['In Move the Shape, high 2 stayed the same on both strings. Here it changes at the crossing.', 'Try the G Major Scale afterward to hear the G-major key signature.'],
    patternHintsByDefault: true, fingeringByDefault: true,
  },
  {
    id: 'pattern-out-of-order', number: '05G', title: 'Read the Shape Out of Order', difficulty: 3, keySignature: 'G', tempo: 72, ...COMMON,
    description: 'Skip and reverse familiar D- and A-string notes.',
    objective: 'Read each note on the staff rather than replaying a memorized scale.',
    measures: bars('G4:h@D3 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'D5:h@A3 B4:h@A1', 'Cn5:h@A2 B4:h@A1'),
    patterns: [
      { start: 0, end: 4, title: 'D string: high 2', cue: 'G–E–F♯–G skips and turns. Fingers 2 and 3 close.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3] },
      { start: 4, end: 8, title: 'A string: low 2', cue: 'D–B–C–B skips and turns. Fingers 1 and 2 close.', string: 'A', closePair: '1–2', demo: [4, 5, 6, 7] },
    ],
    patternHintsByDefault: false, fingeringByDefault: false,
  },
  {
    id: 'pattern-spot-change', number: '05H', title: 'Spot the Change in a Tune', difficulty: 3, keySignature: 'G', tempo: 72, ...COMMON,
    description: 'Find a hand-shape change in a short original tune.',
    objective: 'Inspect both halves of the staff before playing. Where does the hand shape change?',
    measures: bars('E4:h@D1 F#4:h@D2^', 'G4:h@D3 E4:h@D1', 'B4:h@A1 C5:h@A2', 'D5:h@A3 B4:h@A1'),
    patterns: [
      { start: 0, end: 4, title: 'D string: high 2', cue: 'On D, fingers 2 and 3 close: F♯ to G.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3] },
      { start: 4, end: 8, title: 'A string: low 2', cue: 'At the A-string crossing, fingers 1 and 2 become close: B to C.', string: 'A', closePair: '1–2', demo: [4, 5, 6, 7] },
    ],
    patternChallenge: true,
    patternQuestion: 'Inspect both halves of the tune. Where does the hand shape change, and which fingers are close on each string? Use the score page buttons before you answer.',
    patternHintsByDefault: false, fingeringByDefault: false,
  },
  {
    id: 'd-major-scale', number: '06', title: 'D Major Scale', difficulty: 3, keySignature: 'D', tempo: 80, ...COMMON,
    description: 'One octave up and down from D4, in half notes.',
    objective: 'Read the D major key signature: every F and C is sharp.',
    measures: bars('D4:h@D0 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'A4:h@A0 B4:h@A1', 'C#5:h@A2^ D5:h@A3', 'C#5:h@A2^ B4:h@A1', 'A4:h@A0 G4:h@D3', 'F#4:h@D2^ E4:h@D1', 'D4:w@D0'),
    instructions: ['The two sharps at the start of each line apply to every F and C.'],
    patterns: [
      { start: 0, end: 4, title: 'D string group', cue: 'D–E–F♯–G: fingers 2 and 3 close.', string: 'D', closePair: '2–3', demo: [0, 1, 2, 3] },
      { start: 4, end: 8, title: 'A string group', cue: 'A–B–C♯–D: the same finger spacing on A.', string: 'A', closePair: '2–3', demo: [4, 5, 6, 7] },
    ],
    patternHintsByDefault: false,
    fingeringByDefault: false,
  },
  {
    id: 'g-major-scale', number: '07', title: 'G Major Scale', difficulty: 3, keySignature: 'G', tempo: 80, ...COMMON,
    description: 'One octave up and down from G3, in half notes.',
    objective: 'Read the G major key signature: every F is sharp.',
    measures: bars('G3:h@G0 A3:h@G1', 'B3:h@G2^ C4:h@G3', 'D4:h@D0 E4:h@D1', 'F#4:h@D2^ G4:h@D3', 'F#4:h@D2^ E4:h@D1', 'D4:h@D0 C4:h@G3', 'B3:h@G2^ A3:h@G1', 'G3:w@G0'),
    instructions: ['The low notes hang below the staff on ledger lines.', 'C4 uses the third finger on the G string.'],
    fingeringByDefault: false,
  },
  {
    id: 'melody-morning-steps', number: '08A', title: 'Morning Steps', difficulty: 3, keySignature: 'D', tempo: 72, ...COMMON,
    description: 'An original stepwise melody on the D string, then up to A.',
    objective: 'Read a short phrase that changes direction.',
    measures: bars('D4:h@D0 E4:h@D1', 'F#4:h@D2^ D4:h@D0', 'E4:h@D1 F#4:h@D2^', 'G4:w@D3', 'A4:h@A0 G4:h@D3', 'F#4:h@D2^ E4:h@D1', 'F#4:h@D2^ E4:h@D1', 'D4:w@D0'),
    fingeringByDefault: false,
  },
  {
    id: 'melody-a-string-song', number: '08B', title: 'A-String Song', difficulty: 3, keySignature: 'D', tempo: 72, ...COMMON,
    description: 'An original melody on the A string using all four notes learned there.',
    objective: 'Keep the high second finger in tune while the melody moves.',
    measures: bars('A4:h@A0 B4:h@A1', 'C#5:h@A2^ D5:h@A3', 'C#5:h@A2^ A4:h@A0', 'B4:w@A1', 'D5:h@A3 C#5:h@A2^', 'B4:h@A1 A4:h@A0', 'B4:h@A1 C#5:h@A2^', 'D5:w@A3'),
    fingeringByDefault: false,
  },
  {
    id: 'melody-two-strings', number: '08C', title: 'Two-String Tune', difficulty: 4, keySignature: 'D', tempo: 72, ...COMMON,
    description: 'An original tune that moves between the D and A strings.',
    objective: 'Combine string crossings with fingered notes.',
    measures: bars('D4:h@D0 A4:h@A0', 'F#4:h@D2^ A4:h@A0', 'G4:h@D3 B4:h@A1', 'A4:w@A0', 'B4:h@A1 G4:h@D3', 'A4:h@A0 F#4:h@D2^', 'E4:h@D1 F#4:h@D2^', 'D4:w@D0'),
    fingeringByDefault: false,
  },
];

export function findExercise(id: string): Exercise | undefined { return EXERCISES.find(exercise => exercise.id === id); }

/** Fingered semitone offsets in first position. */
const FINGER_SEMITONES: Record<number, number[]> = { 0: [0], 1: [1, 2], 2: [3, 4], 3: [5], 4: [7] };

/** Returns a list of problems; an empty list means the exercise is valid. */
export function validateExercise(exercise: Exercise): string[] {
  const problems: string[] = [];
  const fail = (message: string) => problems.push(`${exercise.id}: ${message}`);
  if (!/^[a-z0-9-]+$/.test(exercise.id)) fail('id must be a lowercase slug');
  if (!exercise.title || !exercise.description || !exercise.objective) fail('title, description, and objective are required');
  if (!(exercise.keySignature in KEY_SIGNATURES)) fail(`unsupported key signature ${exercise.keySignature}`);
  if (exercise.timeSignature.beats !== 4 || exercise.timeSignature.beatValue !== 4) fail('only 4/4 is supported');
  if (exercise.tempo < MIN_BPM || exercise.tempo > MAX_BPM) fail(`tempo ${exercise.tempo} outside ${MIN_BPM}–${MAX_BPM}`);
  if (!exercise.measures.length) fail('at least one measure is required');
  exercise.measures.forEach((measure, m) => {
    const beats = measure.reduce((total, note) => total + DURATION_BEATS[note.duration], 0);
    if (beats !== exercise.timeSignature.beats) fail(`measure ${m + 1} has ${beats} beats`);
    measure.forEach(note => {
      for (const a4 of [MIN_A4, MAX_A4]) {
        const hz = frequencyOf(note.pitch, a4);
        if (hz < PRACTICE.minFrequency || hz > PRACTICE.maxFrequency) fail(`${spell(note.pitch)} at A4=${a4} is outside the detector range`);
      }
      const f = note.fingering;
      if (f) {
        const offset = midiOf(note.pitch) - STRING_OPEN_MIDI[f.string];
        if (!FINGER_SEMITONES[f.finger]?.includes(offset)) fail(`${spell(note.pitch)} is not finger ${f.finger} on the ${f.string} string`);
        if (f.finger === 2 && Boolean(f.high) !== (offset === 4)) fail(`${spell(note.pitch)} high-2 marking is inconsistent`);
      }
    });
  });
  const count = exercise.measures.flat().length;
  exercise.patterns?.forEach(group => {
    if (group.start < 0 || group.end > count || group.start >= group.end) fail('invalid pattern note range');
    if (!group.demo.length || group.demo.some(index => index < group.start || index >= group.end)) fail('pattern demo note outside its group');
  });
  return problems;
}

/** Flattens an exercise into practice notes for the engines and staff, at the given A4. */
export function practiceNotes(exercise: Exercise, a4 = 440): PracticeNote[] {
  return exercise.measures.flatMap((measure, m) => {
    const accidentals = accidentalsForMeasure(measure.map(note => note.pitch), exercise.keySignature);
    return measure.map((note, i) => ({
      id: `${exercise.id}-${m}-${i}`,
      name: spell(note.pitch),
      frequency: frequencyOf(note.pitch, a4),
      vexKey: vexKey(note.pitch),
      beats: DURATION_BEATS[note.duration],
      duration: note.duration,
      measure: m,
      // An explicit natural token also prints a courtesy ♮ when the barline
      // already canceled a sharp; useful for the high/low finger comparison.
      accidental: accidentals[i] ?? (note.pitch.accidental === 'n' ? 'n' : null),
      ...(note.fingering ? { fingering: note.fingering } : {}),
    }));
  });
}

/** Exercise 01 single-string focus: four whole notes of one open string. */
export function focusedExercise(exercise: Exercise, noteName: string): Exercise {
  const source = exercise.measures.flat().find(note => spell(note.pitch) === noteName);
  if (!source) return exercise;
  return { ...exercise, measures: Array.from({ length: 4 }, () => [{ ...source, duration: 'w' as const }]) };
}

/** "G string · open", "D string · 2nd finger (high)" */
export function describeFingering(f: Fingering): string {
  if (f.finger === 0) return `${f.string} string · open`;
  const ordinal = ['', '1st', '2nd', '3rd', '4th'][f.finger];
  return `${f.string} string · ${ordinal} finger${f.high ? ' (high)' : ''}`;
}
/** Compact label under the staff: "D0", "D1", "D↑2". */
export function fingeringLabel(f: Fingering): string { return `${f.string}${f.high ? '↑' : ''}${f.finger}`; }
