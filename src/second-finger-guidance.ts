import { PRACTICE } from './config';
import { matchesTarget, type PracticeNote } from './music';
import { frequencyOf, type Accidental, type Step } from './notation';

export interface SecondFingerMistake { heard: string; advice: string; placement: string }

/** Spell the adjacent second-finger position from the score, not a sharp-only chromatic lookup. */
export function alternateSecondFinger(target: PracticeNote, heardHz: number | null, a4: number): SecondFingerMistake | null {
  const fingering = target.fingering;
  if (fingering?.finger !== 2 || heardHz === null) return null;
  const written = /^([A-G])([♯♭]?)(\d+)$/.exec(target.name);
  if (!written) return null;
  const [, step, accidental, octave] = written;
  const alternate: Accidental | null = fingering.high
    ? accidental === '♯' ? 'n' : accidental === '' ? 'b' : null
    : accidental === '♭' ? 'n' : accidental === '' ? '#' : null;
  if (!alternate) return null;
  const alternateHz = frequencyOf({ step: step as Step, accidental: alternate, octave: Number(octave) }, a4);
  if (!matchesTarget(heardHz, alternateHz, PRACTICE.toleranceCents)) return null;
  const heard = alternate === 'n' ? `${step} natural` : `${step}${alternate === 'b' ? '♭' : '♯'}`;
  const targetName = accidental ? `${step}${accidental}` : `${step} natural`;
  const closeTo = fingering.high ? 'third' : 'first';
  return { heard, advice: `Hearing ${heard}. For ${targetName}, place your second finger close to your ${closeTo}.`, placement: `Hearing ${heard}. Try placing your second finger close to your ${closeTo}.` };
}
