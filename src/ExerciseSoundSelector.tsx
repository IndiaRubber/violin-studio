import type { ExerciseSound } from './exercise-sound';

export function ExerciseSoundSelector({ sound, onChange }: { sound: ExerciseSound; onChange: (sound: ExerciseSound) => void }) {
  return <div className="exercise-sound" role="group" aria-label="Hear note sound">
    <button type="button" aria-pressed={sound === 'tone'} onClick={() => onChange('tone')}>Tone</button>
    <button type="button" aria-pressed={sound === 'violin'} onClick={() => onChange('violin')}>Violin</button>
  </div>;
}
