import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EXERCISES, findExercise, type Exercise } from './curriculum';
import { Practice, type PracticeSummary } from './Practice';
import { PwaStatus } from './PwaStatus';
import { loadReference, saveReference } from './reference';
import { Tuner } from './Tuner';
import { FingerboardTrainer } from './FingerboardTrainer';
import { loadKeepAwake, saveKeepAwake, useScreenWake } from './wake-lock';
import { DailyPractice } from './DailyPractice';
import { addPracticeEvent, lessonEvent, type PracticeEvent } from './practice-history';

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

function Completion({ summary, onAgain, onNext, onHome, historyState, onRetryHistory }: { summary: PracticeSummary; onAgain: () => void; onNext: (() => void) | null; onHome: () => void; historyState: 'idle' | 'saving' | 'saved' | 'error'; onRetryHistory: () => void }) {
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
    <p role="status">{historyState === 'saving' ? 'Saving completion to local history…' : historyState === 'saved' ? 'Saved in local practice history.' : historyState === 'error' ? 'Could not save this completion to local history.' : ''}</p>
    {historyState === 'error' && <button className="secondary" onClick={onRetryHistory}>Retry history save</button>}
    <div className="completion-actions"><button className="primary" onClick={onAgain}>{summary.exerciseId === 'pattern-spot-phrase' || summary.exerciseId === 'pattern-spot-change' ? 'Repeat with cue hidden' : 'Practice again'}</button>{onNext && <button className="secondary" onClick={onNext}>Next exercise</button>}<button className="secondary" onClick={onHome}>Back to exercises</button></div>
  </section>;
}

export function App() {
  const [screen, setScreen] = useState<'select' | 'exercise' | 'complete' | 'tuner' | 'fingerboard' | 'daily'>('select');
  const [a4, setA4] = useState(loadReference);
  useEffect(() => saveReference(a4), [a4]);
  const [keepAwake, setKeepAwake] = useState(loadKeepAwake);
  useEffect(() => saveKeepAwake(keepAwake), [keepAwake]);
  const [tunerActive, setTunerActive] = useState(false);
  const wakeWanted = screen === 'exercise' || screen === 'fingerboard' || screen === 'tuner' && tunerActive;
  const wakeStatus = useScreenWake(wakeWanted, keepAwake);
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const exercise = findExercise(exerciseId) ?? EXERCISES[0];
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [historyState, setHistoryState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savedVisits = useRef(new Set<number>());
  const pendingHistory = useRef<PracticeEvent | null>(null);
  const saveCompletion = (event: PracticeEvent) => {
    setHistoryState('saving');
    void addPracticeEvent(event).then(() => { if (pendingHistory.current?.id === event.id) setHistoryState('saved'); })
      .catch(() => { if (pendingHistory.current?.id === event.id) setHistoryState('error'); });
  };
  // Remounting Practice gives each visit a fresh exercise and microphone session.
  const [visit, setVisit] = useState(0);
  const listScroll = useRef(0);
  // Change scroll only when changing screens, never as a note or hold progresses.
  useLayoutEffect(() => {
    if (screen === 'exercise') window.scrollTo(0, 0);
    if (screen === 'select') window.scrollTo(0, listScroll.current);
  }, [screen, visit]);
  const openExercise = (id: string, keepFocus = false) => {
    if (screen === 'select') listScroll.current = window.scrollY;
    if (!keepFocus) setSummary(null);
    setExerciseId(id); setVisit(v => v + 1); setHistoryState('idle'); pendingHistory.current = null; setScreen('exercise');
  };
  const finishExercise = (result: PracticeSummary) => {
    if (savedVisits.current.has(visit)) return;
    savedVisits.current.add(visit);
    const event = lessonEvent(result);
    pendingHistory.current = event;
    setSummary(result); setScreen('complete'); saveCompletion(event);
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
        <button className="exercise-card" onClick={() => setScreen('daily')}><span className="card-icon">◇</span><span><strong>Today’s Practice</strong><small>Warmups and local practice history</small></span><span aria-hidden="true">→</span></button>
        <label className="home-setting"><input type="checkbox" checked={keepAwake} onChange={event => setKeepAwake(event.target.checked)} /> Keep screen awake during practice</label>
        <button className="exercise-card" onClick={() => setScreen('tuner')}><span className="card-icon">♮</span><span><strong>Instrument Tuner</strong><small>Violin strings or chromatic · No scoring</small></span><span aria-hidden="true">→</span></button>
        <button className="exercise-card" onClick={() => setScreen('fingerboard')}><span className="card-icon">♬</span><span><strong>Fingerboard Trainer</strong><small>Explore notes, find positions, and read from the staff</small></span><span aria-hidden="true">→</span></button>
        <h2 className="library-heading">Exercises</h2>
        <div className="library" role="list">{EXERCISES.map(e => <div role="listitem" key={e.id}>{e.id === 'pattern-move-one-finger' && <h3 className="library-section">Finger Patterns</h3>}{e.id === 'd-major-scale' && <h3 className="library-section">Scales &amp; tunes</h3>}{e.id === 'board-close-pair-d' && <h3 className="library-section">Fingerboard tunes</h3>}<ExerciseCard exercise={e} onOpen={() => openExercise(e.id)} /></div>)}</div>
      </section>}
      {screen === 'tuner' && <Tuner onBack={goHome} a4={a4} onReferenceChange={setA4} onActiveChange={setTunerActive} />}
      {screen === 'fingerboard' && <FingerboardTrainer a4={a4} onBack={goHome} onOpenLesson={() => openExercise('board-close-pair-d')} />}
      {screen === 'daily' && <DailyPractice onBack={goHome} onOpenLesson={goHome} />}
      {screen === 'exercise' && <Practice key={visit} exercise={exercise} a4={a4} initialFocus={summary?.exerciseId === exercise.id ? summary.focus : null} onBack={goHome} onOpenExercise={id => openExercise(id)} onComplete={finishExercise} />}
      {screen === 'complete' && summary && <Completion summary={summary} historyState={historyState} onRetryHistory={() => { if (pendingHistory.current) saveCompletion(pendingHistory.current); }} onAgain={() => openExercise(exerciseId, true)} onNext={next ? () => openExercise(next.id) : null} onHome={goHome} />}
      {wakeWanted && keepAwake && wakeStatus !== 'off' && <p className="wake-status" role="status">{wakeStatus === 'active' ? 'Screen awake during practice' : wakeStatus === 'requesting' ? 'Requesting screen wake lock…' : wakeStatus === 'unavailable' ? 'Screen wake lock unavailable in this browser' : 'Screen may sleep; wake lock was not granted'}</p>}
    </main><PwaStatus /><footer>Local practice · No account or upload</footer>
  </div>;
}
