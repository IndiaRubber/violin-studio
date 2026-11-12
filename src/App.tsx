import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioSession, type AudioDiagnostics } from './audio';
import { ExerciseEngine, type Evaluation } from './exercise';
import { OPEN_STRINGS_EXERCISE, centsFromTarget, frequencyToNote } from './music';
import { loadReference, saveReference, scaledNotes } from './reference';
import type { PitchReading } from './pitch';
import { Staff } from './Staff';
import { Tuner } from './Tuner';

const exercise = OPEN_STRINGS_EXERCISE;
const initialEvaluation: Evaluation = { index: 0, complete: false, state: 'quiet', stableMs: 0, cents: null, advanced: false };

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Microphone access was denied. Allow access in your browser settings, then try again.';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No microphone was found. Connect one, then try again.';
  return error instanceof Error ? error.message : 'Could not start the microphone. Check the input device and try again.';
}

export function App() {
  const [screen, setScreen] = useState<'select' | 'exercise' | 'complete' | 'tuner'>('select');
  const [a4, setA4] = useState(loadReference);
  const notes = useMemo(() => scaledNotes(exercise.notes, a4), [a4]);
  useEffect(() => saveReference(a4), [a4]);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation>(initialEvaluation);
  const [audioDetails, setAudioDetails] = useState<AudioDiagnostics | null>(null);
  const session = useRef<AudioSession | null>(null);
  const engine = useRef(new ExerciseEngine(notes));
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    session.current?.stop(); session.current = null;
    setListening(false); setStarting(false); setReading(null);
    setAudioDetails(null);
  };
  useEffect(() => () => { session.current?.stop(); generation.current++; }, []);
  const start = async () => {
    if (starting || listening) return;
    setError(''); setStarting(true);
    const token = ++generation.current;
    const audio = new AudioSession((next, time) => {
      if (token !== generation.current) return;
      setReading(next);
      const result = engine.current.evaluate(next, time);
      setEvaluation(result);
      if (result.complete) { audio.stop(); session.current = null; setListening(false); setScreen('complete'); }
    }, (message) => { if (token === generation.current) { setListening(false); setError(message ?? 'Microphone input stopped. Reconnect it and start listening again.'); } }, details => { if (token === generation.current) setAudioDetails(details); });
    session.current = audio;
    try {
      await audio.start();
      if (token === generation.current) setListening(true);
    } catch (cause) { if (token === generation.current) { session.current = null; setError(errorMessage(cause)); } }
    if (token === generation.current) setStarting(false);
  };
  const openExercise = () => { stop(); engine.current = new ExerciseEngine(notes); setEvaluation(initialEvaluation); setError(''); setScreen('exercise'); };
  const openTuner = () => { stop(); setError(''); setScreen('tuner'); };
  const goHome = () => { stop(); setScreen('select'); setError(''); };
  const target = notes[Math.min(evaluation.index, notes.length - 1)];
  const cents = reading?.smoothHz && evaluation.state !== 'release' ? centsFromTarget(reading.smoothHz, target.frequency) : null;
  const meterCents = cents === null ? 0 : Math.max(-60, Math.min(60, cents));
  const feedback = !listening ? 'Start listening when you are ready.' : evaluation.state === 'matching' ? 'Hold it steady…' : evaluation.state === 'wrong' ? 'Different note. Try the one on the staff.' : evaluation.state === 'uncertain' || evaluation.state === 'outlier' ? 'Uncertain sound. Try a clear, steady bow.' : evaluation.state === 'quiet' ? 'Waiting for a note…' : evaluation.state === 'release' ? 'Good. Pause or change strings for the next note.' : 'Play the note on the staff.';
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-mark">𝄞</span><span>Violin Studio</span></div><span className="header-tag">Practice at your pace</span></header>
    <main>
      {screen === 'select' && <section className="welcome"><p className="eyebrow">A quiet place to practice</p><h1>Hear the note. Find your sound.</h1><p>Play a real violin and follow the notes on the staff. Start with the four open strings.</p><button className="exercise-card" onClick={openExercise}><span className="card-icon">𝄞</span><span><strong>Open Strings Practice</strong><small>G · D · A · E &nbsp;•&nbsp; No rhythm scoring</small></span><span aria-hidden="true">→</span></button><button className="exercise-card" onClick={openTuner}><span className="card-icon">♮</span><span><strong>Instrument Tuner</strong><small>Violin strings or chromatic · No scoring</small></span><span aria-hidden="true">→</span></button></section>}
      {screen === 'tuner' && <Tuner onBack={goHome} a4={a4} onReferenceChange={setA4} />}
      {screen === 'exercise' && <section className="practice"><div className="practice-heading"><button className="text-button" onClick={goHome}>← Exercises</button><span>Exercise 01 / Open strings</span></div><h1>Open Strings Practice</h1><div className="progress-label"><span>Note {evaluation.index + 1} of {exercise.notes.length}</span><span>{evaluation.index} complete</span></div><div className="progress-track"><div style={{ width: `${evaluation.index / exercise.notes.length * 100}%` }} /></div><div className="score-card"><div className="score-heading"><span>Play this note</span><label><input type="checkbox" checked={showHints} onChange={event => setShowHints(event.target.checked)} /> Show note names</label></div><Staff notes={notes} currentIndex={evaluation.index} showHints={showHints} /></div><div className="feedback-grid"><div className="feedback-card"><p className="eyebrow">Target</p><strong>{target.name}</strong><small>{target.frequency.toFixed(2)} Hz</small></div><div className="feedback-card"><p className="eyebrow">Detected</p><strong>{reading?.smoothHz ? frequencyToNote(reading.smoothHz, a4) : '—'}</strong><small>{reading?.reason === 'quiet' ? 'Insufficient signal' : reading?.reason === 'uncertain' || reading?.reason === 'outlier' ? 'Uncertain detection' : listening ? 'Listening' : 'Microphone off'}</small></div><div className="feedback-card meter-card"><p className="eyebrow">Intonation</p><strong>{cents === null ? '—' : `${cents > 0 ? '+' : ''}${Math.round(cents)} cents`}</strong><div className="meter"><span className="center-line"/><span className="meter-needle" style={{ left: `${50 + meterCents / 120 * 100}%` }}/></div><div className="meter-labels"><span>Flat</span><span>In tune</span><span>Sharp</span></div></div></div><p className="status" role="status">{feedback}</p>{error && <p className="error" role="alert">{error}</p>}<div className="actions"><button className="primary" onClick={listening || starting ? stop : start}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button></div><details className="diagnostics"><summary>Developer diagnostics</summary><dl><dt>Raw frequency</dt><dd>{reading?.rawHz?.toFixed(1) ?? '—'} Hz</dd><dt>Smoothed frequency</dt><dd>{reading?.smoothHz?.toFixed(1) ?? '—'} Hz</dd><dt>Clarity</dt><dd>{reading?.clarity.toFixed(3) ?? '—'}</dd><dt>Input level (RMS)</dt><dd>{reading?.rms.toFixed(4) ?? '—'}</dd><dt>Estimated note</dt><dd>{reading?.smoothHz ? frequencyToNote(reading.smoothHz, a4) : '—'}</dd><dt>Target deviation</dt><dd>{cents?.toFixed(1) ?? '—'} cents</dd><dt>Match / stability</dt><dd>{evaluation.state} / {Math.round(evaluation.stableMs)} ms</dd><dt>Sample rate</dt><dd>{audioDetails?.sampleRate ?? '—'} Hz</dd><dt>AudioContext</dt><dd>{audioDetails?.contextState ?? 'unavailable'}</dd><dt>Requested processing</dt><dd>Echo: off · Noise: off · Gain: off</dd><dt>Applied track settings</dt><dd>{audioDetails?.applied ? JSON.stringify(audioDetails.applied) : 'Unavailable'}</dd></dl></details></section>}
      {screen === 'complete' && <section className="completion"><p className="eyebrow">Practice complete</p><h1>Four open strings played.</h1><p>You matched G, D, A, and E with a steady pitch. Take a break or practice again.</p><div className="completion-actions"><button className="primary" onClick={openExercise}>Practice again</button><button className="secondary" onClick={goHome}>Back to exercises</button></div></section>}
    </main><footer>Local practice · No account or upload</footer>
  </div>;
}
