import type { Exercise, PatternGroup } from './curriculum';
import type { PracticeNote } from './music';

export function activePattern(exercise: Exercise, noteIndex: number): PatternGroup | null {
  return exercise.patterns?.find(group => noteIndex >= group.start && noteIndex < group.end) ?? null;
}

export function patternVisible(exercise: Exercise, saved: boolean | undefined, answerShown: boolean, cueHidden = false): boolean {
  if (exercise.patternChallenge) return answerShown && !cueHidden;
  return saved ?? exercise.patternHintsByDefault ?? false;
}

export function demoFrequencies(notes: PracticeNote[], group: PatternGroup): number[] {
  return group.demo.map(index => {
    if (index < group.start || index >= group.end || !notes[index]) throw new Error('Pattern demo note is outside its group.');
    return notes[index].frequency;
  });
}

export function patternRange(group: PatternGroup): string {
  return `notes ${group.start + 1}–${group.end}`;
}
