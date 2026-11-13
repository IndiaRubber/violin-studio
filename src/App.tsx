import { useEffect, useState } from 'react';
import { EXERCISES, findExercise, type Exercise } from './curriculum';
import { Practice, type PracticeSummary } from './Practice';
import { PwaStatus } from './PwaStatus';
import { loadReference, saveReference } from './reference';
import { Tuner } from './Tuner';

const durationsOf = (exercise: Exercise) => {
  const kinds = new Set(exercise.measures.flat().map(note => note.duration));
  return kinds.has('h') ? (kinds.has('w') ? 'Half & whole notes' : 'Half notes') : 'Whole notes';
};

function ExerciseCard({ exercise, onOpen }: { exercise: Exercise; onOpen: () => void }) {
  return <button className="exercise-card library-card" onClick={onOpen}>
    <span className="card-number">{exercise.number}</span>
    <span><strong>{exercise.title}</strong><small>{exercise.description}</small>
      <small className="card-meta">{exercise.keySignature === 'C' ? 'No key signature' : `${exercise.keySignature} major`} · {durationsOf(exercise)} · ♩ = {exercise.tempo} · <span aria-label={`Difficulty ${exercise.difficulty} of 5`}>{'●'.repeat(exercise.difficulty)}{'○'.repeat(5 - exercise.difficulty)}</span></small></span>
    <span aria-hidden="true">→</span>
  </button>;
}

function Completion({ summary, onAgain, onNext, onHome }: { summary: PracticeSummary; onAgain: () => void; onNext: (() => void) | null; onHome: () => void }) {
  const distinct = [...new Set(summary.notes)];
  const attempts = summary.retriedNotes === 0
    ? 'Every note was held on the first try.'
    : `${summary.retriedNotes} ${summary.retriedNotes === 1 ? 'note' : 'notes'} took another try (${summary.extraAttempts} extra ${summary.extraAttempts === 1 ? 'attempt' : 'attempts'}). That is a normal part of practising.`;
  return <section className="completion">
    <p className="eyebrow">Exercise complete</p>
    <h1>{summary.title}{summary.focus ? ` · ${summary.focus}` : ''}</h1>
    <dl className="summary">
      <dt>Notes practised</dt><dd>{summary.notes.length} ({distinct.join(', ')})</dd>
      <dt>Practice</dt><dd>{summary.mode === 'sustain' ? `Guided: found and held each note at ♩ = ${summary.tempo}` : 'Quick check: recognized each pitch'}</dd>
      {summary.mode === 'sustain' && <><dt>Attempts</dt><dd>{attempts}</dd></>}
    </dl>
    <p className="summary-note">This summary reflects pitch only. It does not judge bowing, posture, finger placement, or tone.</p>
    <div className="completion-actions"><button className="primary" onClick={onAgain}>Practice again</button>{onNext && <button className="secondary" onClick={onNext}>Next exercise</button>}<button className="secondary" onClick={onHome}>Back to exercises</button></div>
  </section>;
}

export function App() {
  const [screen, setScreen] = useState<'select' | 'exercise' | 'complete' | 'tuner'>('select');
  const [a4, setA4] = useState(loadReference);
  useEffect(() => saveReference(a4), [a4]);
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const exercise = findExercise(exerciseId) ?? EXERCISES[0];
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  // Remounting Practice gives each visit a fresh exercise and microphone session.
  const [visit, setVisit] = useState(0);
  const openExercise = (id: string, keepFocus = false) => {
    if (!keepFocus) setSummary(null);
    setExerciseId(id); setVisit(v => v + 1); setScreen('exercise');
  };
  const goHome = () => setScreen('select');
  const nextIndex = EXERCISES.findIndex(e => e.id === exerciseId) + 1;
  const next = EXERCISES[nextIndex];
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-mark">𝄞</span><span>Violin Studio</span></div><span className="header-tag">Practice at your pace</span></header>
    <main>
      {screen === 'select' && <section className="welcome">
        <p className="eyebrow">A quiet place to practice</p><h1>Hear the note. Find your sound.</h1>
        <p>Play a real violin and follow the notes on the staff. Work through the exercises in order, or pick any one.</p>
        <button className="exercise-card" onClick={() => setScreen('tuner')}><span className="card-icon">♮</span><span><strong>Instrument Tuner</strong><small>Violin strings or chromatic · No scoring</small></span><span aria-hidden="true">→</span></button>
        <h2 className="library-heading">Exercises</h2>
        <div className="library" role="list">{EXERCISES.map(e => <div role="listitem" key={e.id}><ExerciseCard exercise={e} onOpen={() => openExercise(e.id)} /></div>)}</div>
      </section>}
      {screen === 'tuner' && <Tuner onBack={goHome} a4={a4} onReferenceChange={setA4} />}
      {screen === 'exercise' && <Practice key={visit} exercise={exercise} a4={a4} initialFocus={summary?.exerciseId === exercise.id ? summary.focus : null} onBack={goHome} onComplete={result => { setSummary(result); setScreen('complete'); }} />}
      {screen === 'complete' && summary && <Completion summary={summary} onAgain={() => openExercise(exerciseId, true)} onNext={next ? () => openExercise(next.id) : null} onHome={goHome} />}
    </main><PwaStatus /><footer>Local practice · No account or upload</footer>
  </div>;
}
