import { PRACTICE } from './config';
import { frequencyToNote, matchesTarget, type PracticeNote } from './music';

export interface SecondFingerMistake { heard: string; advice: string }

/** Classify the other second-finger position, independently of the target's cents reading. */
export function alternateSecondFinger(target: PracticeNote, heardHz: number | null, a4: number): SecondFingerMistake | null {
  const fingering = target.fingering;
  if (fingering?.finger !== 2 || heardHz === null) return null;
  const alternateHz = target.frequency * 2 ** ((fingering.high ? -1 : 1) / 12);
  if (!matchesTarget(heardHz, alternateHz, PRACTICE.toleranceCents)) return null;
  const note = frequencyToNote(alternateHz, a4);
  if (!note) return null;
  const noteName = note.replace(/\d+$/, '');
  const heard = /^[A-G]$/.test(noteName) ? `${noteName} natural` : noteName;
  const targetName = target.name.replace(/\d+$/, '');
  const closeTo = fingering.high ? 'third' : 'first';
  return { heard, advice: `Hearing ${heard}. For ${targetName}, place your second finger close to your ${closeTo}.` };
}
