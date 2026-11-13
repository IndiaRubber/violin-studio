import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioSession, type AudioDiagnostics } from './audio';
import { REFERENCE_TONE } from './config';
import { describeFingering, fingeringLabel, focusedExercise, practiceNotes, type Exercise } from './curriculum';
import { centsFromTarget, frequencyToNote } from './music';
import { DURATION_NAMES, KEY_NAMES } from './notation';
import type { PitchReading } from './pitch';
import { initialPracticeEvaluation, PracticeSession, type PracticeMode } from './practice-session';
import { loadPreferences, savePreferences, type NameHints } from './preferences';
import { Staff } from './Staff';
import type { PracticeEvaluation, ResetReason } from './sustain';
import { clampTempo, MAX_BPM, MIN_BPM, noteMs, TEMPO_STEP, WHOLE_NOTE_BEATS } from './tempo';
import { ReferenceTonePlayer } from './tone';

export interface PracticeSummary {
  exerciseId: string;
  title: string;
  mode: PracticeMode;
  tempo: number;
  /** Written note names practised, in order. */
  notes: string[];
  /** Single-string focus (exercise 01), or null for the full exercise. */
  focus: string | null;
  /** Notes that needed more than one attempt, and how many extra attempts in total. */
  retriedNotes: number;
  extraAttempts: number;
}
const UI_INTERVAL_MS = 100; // the microphone polls every 50 ms; the UI only needs ~10 updates/s
const NAME_HINT_LABELS: Record<NameHints, string> = { always: 'Always', after: 'After playing', off: 'Hidden' };

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Microphone access was denied. Allow access in your browser settings, then try again.';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No microphone was found. Connect one, then try again.';
  return error instanceof Error ? error.message : 'Could not start the microphone. Check the input device and try again.';
}

function guidance(evaluation: PracticeEvaluation, mode: PracticeMode, listening: boolean, reset: ResetReason): string {
  if (!listening) return mode === 'sustain' ? 'Tap Hear note if you like, then Start Listening when you are ready.' : 'Start listening when you are ready.';
  const c = evaluation.cents;
  switch (evaluation.state) {
    case 'reference': return 'Listening is paused while the reference note plays.';
    case 'release': return mode === 'sustain' ? 'Well held. Lift the bow briefly, then play the next note.' : 'Good. Pause or change strings for the next note.';
    case 'holding': return `Hold it steady — beat ${evaluation.beat} of ${evaluation.beats}.`;
    case 'wavering': return 'Keep the bow moving and bring the pitch back to the note.';
    case 'matching': return mode === 'sustain' ? 'That’s the note — keep it steady…' : 'Hold it steady…';
    case 'wrong':
      if (reset) return 'The pitch moved away. Find the note again — no rush.';
      if (c !== null && Math.abs(c) <= 100) return c < 0 ? 'A little flat — move the pitch up.' : 'A little sharp — move the pitch down.';
      return 'Different note. Try the one on the staff.';
    case 'uncertain': case 'outlier': return reset ? 'The sound broke up. Find the note again — no rush.' : 'Uncertain sound. Try a clear, steady bow.';
    case 'quiet':
      if (reset === 'lost') return 'The sound stopped before the note’s full length. Find it again — no rush.';
      if (reset === 'unsteady') return 'The pitch wandered too much. Find it again and hold it steady.';
      return mode === 'sustain' ? 'Find the note on the staff. Take your time.' : 'Waiting for a note…';
    default: return 'Play the note on the staff.';
  }
}

export function Practice({ exercise, a4, onBack, onComplete, initialFocus = null }: { exercise: Exercise; a4: number; onBack: () => void; onComplete: (summary: PracticeSummary) => void; initialFocus?: string | null }) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const { mode, names } = prefs;
  const tempo = prefs.tempos[exercise.id] ?? exercise.tempo;
  const showFingering = prefs.fingering[exercise.id] ?? exercise.fingeringByDefault;
  useEffect(() => savePreferences(prefs), [prefs]);
  const focusChoices = useMemo(() => exercise.stringFocus ? [...new Set(practiceNotes(exercise).map(n => n.name))] : [], [exercise]);
  const [focus, setFocus] = useState<string | null>(initialFocus && focusChoices.includes(initialFocus) ? initialFocus : null);
  const notes = useMemo(() => practiceNotes(focus ? focusedExercise(exercise, focus) : exercise, a4), [exercise, focus, a4]);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [evaluation, setEvaluation] = useState<PracticeEvaluation>(() => initialPracticeEvaluation(tempo, notes[0]?.beats));
  const [lastReset, setLastReset] = useState<ResetReason>(null);
  const [audioDetails, setAudioDetails] = useState<AudioDiagnostics | null>(null);
  const [toneState, setToneState] = useState<'idle' | 'playing' | 'settling'>('idle');
  const audio = useRef<AudioSession | null>(null);
  const practice = useRef<PracticeSession>(null as unknown as PracticeSession);
  practice.current ??= new PracticeSession(notes, mode, tempo);
  const player = useRef<ReferenceTonePlayer | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const published = useRef({ at: -Infinity, key: '' });
  const scoreCard = useRef<HTMLDivElement>(null);
  /** Extra attempts per note index (automatic hold resets plus "Restart note"). */
  const attempts = useRef(new Map<number, number>());
  const countAttempt = (index: number) => attempts.current.set(index, (attempts.current.get(index) ?? 0) + 1);
  const summary = useRef<() => PracticeSummary>(() => null as never);
  summary.current = () => ({
    exerciseId: exercise.id, title: exercise.title, mode, tempo, notes: notes.map(n => n.name), focus,
    retriedNotes: attempts.current.size, extraAttempts: [...attempts.current.values()].reduce((a, b) => a + b, 0),
  });

  // An interrupted capture cannot keep a partial hold.
  const abandonHold = () => {
    practice.current.restartNote();
    setEvaluation(e => ({ ...e, phase: e.phase === 'hold' ? 'find' : e.phase, state: 'quiet', holdMs: 0, beat: 0, cents: null }));
  };
  const stopListening = () => {
    generation.current++;
    audio.current?.stop(); audio.current = null;
    setListening(false); setStarting(false); setReading(null); setAudioDetails(null);
    abandonHold();
  };
  const restartExercise = (nextNotes = notes, nextMode = mode) => {
    const suppressedUntil = practice.current.suppressionEnd; // a playing reference tone must stay ignored
    practice.current = new PracticeSession(nextNotes, nextMode, tempo);
    if (suppressedUntil > performance.now()) practice.current.suppress(suppressedUntil);
    published.current = { at: -Infinity, key: '' };
    attempts.current = new Map();
    setEvaluation(initialPracticeEvaluation(tempo, nextNotes[0]?.beats)); setLastReset(null);
  };
  useEffect(() => () => {
    generation.current++;
    audio.current?.stop();
    player.current?.dispose();
    window.clearTimeout(settleTimer.current);
  }, []);
  // Changing the string focus or A4 reference starts the exercise again with the new notes.
  const firstNotes = useRef(true);
  useEffect(() => { if (firstNotes.current) { firstNotes.current = false; return; } restartExercise(notes, mode); }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = (next: PitchReading, result: PracticeEvaluation, time: number) => {
    const key = `${result.index}|${result.phase}|${result.state}|${result.beat}|${result.reset}`;
    if (key === published.current.key && time - published.current.at < UI_INTERVAL_MS && !result.advanced) return;
    published.current = { at: time, key };
    setReading(next); setEvaluation(result);
    if (result.reset) setLastReset(result.reset);
    else if (result.phase === 'hold' || result.advanced || result.state === 'matching') setLastReset(null);
  };

  const start = async () => {
    if (starting || listening) return;
    setError(''); setStarting(true);
    const token = ++generation.current;
    const session = new AudioSession((next, time) => {
      if (token !== generation.current) return;
      const result = practice.current.evaluate(next, time);
      if (result.reset) countAttempt(result.index);
      publish(next, result, time);
      if (result.complete) {
        session.stop(); audio.current = null; setListening(false);
        onComplete(summary.current());
      }
    }, message => { if (token === generation.current) { audio.current = null; setListening(false); setReading(null); abandonHold(); setError(message ?? 'Microphone input stopped. Reconnect it and start listening again.'); } },
    details => { if (token === generation.current) setAudioDetails(details); });
    audio.current = session;
    try {
      await session.start();
      if (token === generation.current) {
        setListening(true);
        // Bring the staff, feedback and controls into one view on small screens.
        if (window.innerHeight < 900) scoreCard.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch (cause) { if (token === generation.current) { audio.current = null; setError(errorMessage(cause)); } }
    if (token === generation.current) setStarting(false);
  };

  const targetIndex = Math.min(evaluation.index, notes.length - 1);
  const target = notes[targetIndex];
  const playReference = async () => {
    window.clearTimeout(settleTimer.current);
    player.current ??= new ReferenceTonePlayer();
    const settle = () => {
      practice.current.suppress(performance.now() + REFERENCE_TONE.settleMs);
      setToneState('settling');
      settleTimer.current = window.setTimeout(() => setToneState('idle'), REFERENCE_TONE.settleMs);
    };
    if (player.current.playing) { player.current.stop(); return; }
    try {
      // Suppress first so no frame captured during start-up can count.
      practice.current.suppress(performance.now() + REFERENCE_TONE.durationMs + REFERENCE_TONE.settleMs + 100);
      setToneState('playing');
      const duration = await player.current.play(target.frequency, settle);
      practice.current.suppress(performance.now() + duration + REFERENCE_TONE.settleMs);
    } catch {
      setToneState('idle');
      setError('The reference note could not play. Check that the device is not muted, then try again.');
    }
  };

  const changeTempo = (value: number) => {
    const next = clampTempo(value);
    setPrefs(p => ({ ...p, tempos: { ...p.tempos, [exercise.id]: next } }));
    practice.current.setTempo(next);
    setEvaluation(e => ({ ...e, requiredMs: noteMs(e.beats || WHOLE_NOTE_BEATS, next), ...(e.phase === 'hold' ? { phase: 'find' as const, holdMs: 0, beat: 0, state: 'quiet' as const } : {}) }));
  };
  const changeMode = (next: PracticeMode) => { if (next === mode) return; setPrefs(p => ({ ...p, mode: next })); restartExercise(notes, next); };
  const restartNote = () => { if (evaluation.phase === 'hold') countAttempt(evaluation.index); abandonHold(); setLastReset(null); };

  const sustain = mode === 'sustain';
  const cents = reading?.smoothHz && evaluation.state !== 'release' && evaluation.state !== 'reference' ? centsFromTarget(reading.smoothHz, target.frequency) : null;
  const meterCents = cents === null ? 0 : Math.max(-60, Math.min(60, cents));
  const holding = evaluation.phase === 'hold';
  const beats = target.beats ?? WHOLE_NOTE_BEATS;
  const progress = holding ? Math.min(1, evaluation.holdMs / evaluation.requiredMs) : 0;
  const seconds = (noteMs(beats, tempo) / 1000).toFixed(1).replace(/\.0$/, '');
  const feedback = guidance(evaluation, mode, listening, evaluation.phase === 'find' ? lastReset : null);
  const showTargetName = names === 'always';
  const labels = notes.map((note, i) => names === 'always' || (names === 'after' && i < evaluation.index) ? note.name : i < evaluation.index ? '✓' : i === evaluation.index ? 'Now' : '·');
  const fingering = showFingering ? notes.map(note => note.fingering ? fingeringLabel(note.fingering) : null) : null;
  const durations = new Set(notes.map(n => n.duration ?? 'w'));

  return <section className="practice">
    <div className="practice-heading"><button className="text-button" onClick={() => { stopListening(); onBack(); }}>← Exercises</button><span>Exercise {exercise.number}{focus ? ` / ${focus} focus` : ''}</span></div>
    <h1>{exercise.title}</h1>
    <p className="objective">{exercise.objective}</p>
    <div className="progress-label"><span>Note {Math.min(evaluation.index + 1, notes.length)} of {notes.length}</span><span>{evaluation.index} complete</span></div>
    <div className="progress-track"><div style={{ width: `${evaluation.index / notes.length * 100}%` }} /></div>
    <div className="score-card" ref={scoreCard}>
      <div className="score-heading"><span>{sustain ? 'Find each note, then hold it' : 'Play each note'}</span><span className="mode-tag">{sustain ? `${tempo} BPM` : 'Quick check'}</span></div>
      <Staff notes={notes} currentIndex={evaluation.index} keySignature={exercise.keySignature} tempo={sustain ? tempo : undefined} labels={labels} fingering={fingering} />
    </div>
    <div className="feedback-grid">
      <div className="feedback-card target-card"><div><p className="eyebrow">Target</p><strong>{showTargetName ? target.name : '?'}</strong><small>{showTargetName ? `${target.frequency.toFixed(2)} Hz` : 'Read the staff'}</small>{showFingering && target.fingering && <small className="fingering-hint">{describeFingering(target.fingering)}</small>}</div>
        <button type="button" className={`tone-button ${toneState !== 'idle' ? 'is-playing' : ''}`} onClick={() => void playReference()} aria-pressed={toneState === 'playing'}><span aria-hidden="true">{toneState === 'playing' ? '■' : '♪'}</span>{toneState === 'playing' ? 'Stop' : 'Hear note'}</button></div>
      <div className="feedback-card"><p className="eyebrow">Detected</p><strong>{reading?.smoothHz && evaluation.state !== 'reference' ? frequencyToNote(reading.smoothHz, a4) : '—'}</strong><small>{evaluation.state === 'reference' ? 'Paused for reference' : reading?.reason === 'quiet' ? 'Insufficient signal' : reading?.reason === 'uncertain' || reading?.reason === 'outlier' ? 'Uncertain detection' : listening ? 'Listening' : 'Microphone off'}</small></div>
      <div className="feedback-card meter-card"><p className="eyebrow">Intonation <strong>{cents === null ? '—' : `${cents > 0 ? '+' : ''}${Math.round(cents)} cents`}</strong></p><div className="meter"><span className="center-line"/><span className="meter-needle" style={{ left: `${50 + meterCents / 120 * 100}%` }}/></div><div className="meter-labels"><span>Flat</span><span>In tune</span><span>Sharp</span></div></div>
    </div>
    {toneState !== 'idle' && <p className="tone-status" role="status">{toneState === 'playing' ? `♪ Playing the reference ${showTargetName ? target.name : 'note'} — microphone paused` : 'Microphone resuming…'}</p>}
    {sustain && <div className={`hold-card ${holding ? 'is-holding' : ''}`} aria-label={holding ? `Holding: beat ${evaluation.beat} of ${beats}` : 'Hold not started'}>
      <div className="beats">{Array.from({ length: beats }, (_, i) => <span key={i} className={`beat ${holding && i < evaluation.beat - 1 ? 'done' : ''} ${holding && i === evaluation.beat - 1 ? 'now' : ''}`}>{i + 1}</span>)}</div>
      <div className="hold-track"><div style={{ width: `${progress * 100}%` }} /></div>
      <small><span>{holding ? `Beat ${evaluation.beat} of ${beats}${evaluation.state === 'wavering' ? ' · steady the pitch' : ''}` : 'Starts when the note is steady'}</span><span>{DURATION_NAMES[target.duration ?? 'w']} = {beats} beats = {seconds} s</span></small>
    </div>}
    <p className="status" role="status">{feedback}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button className="primary" onClick={listening || starting ? stopListening : start}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button><button className="secondary" aria-label="Restart note" onClick={restartNote}>↺ <span className="wide-only">Restart </span>note</button><button className="secondary" aria-label="Restart exercise" onClick={() => restartExercise()}>↺ <span className="wide-only">Restart </span>exercise</button></div>
    <div className="practice-options">
      <fieldset><legend>Practice mode</legend><div className="segmented"><button type="button" aria-pressed={sustain} onClick={() => changeMode('sustain')}>Guided: find &amp; hold</button><button type="button" aria-pressed={!sustain} onClick={() => changeMode('quick')}>Quick check</button></div></fieldset>
      <fieldset className="tempo-control" disabled={!sustain}><legend>Tempo <span className="hint">(suggested {exercise.tempo})</span></legend><div className="stepper"><button type="button" aria-label="Slower" onClick={() => changeTempo(tempo - TEMPO_STEP)} disabled={tempo <= MIN_BPM}>−</button><output aria-live="off" aria-label="Tempo">{tempo} BPM</output><button type="button" aria-label="Faster" onClick={() => changeTempo(tempo + TEMPO_STEP)} disabled={tempo >= MAX_BPM}>+</button></div></fieldset>
      {focusChoices.length > 0 && <fieldset className="string-focus"><legend>Strings</legend><div className="chips">{[null, ...focusChoices].map(choice => <button key={choice ?? 'all'} type="button" aria-pressed={focus === choice} onClick={() => { if (focus !== choice) setFocus(choice); }}>{choice ?? 'All'}</button>)}</div></fieldset>}
      <fieldset><legend>Note names</legend><div className="segmented">{(['always', 'after', 'off'] as NameHints[]).map(value => <button key={value} type="button" aria-pressed={names === value} onClick={() => setPrefs(p => ({ ...p, names: value }))}>{NAME_HINT_LABELS[value]}</button>)}</div></fieldset>
      <label className="hint-toggle"><input type="checkbox" checked={showFingering} onChange={event => setPrefs(p => ({ ...p, fingering: { ...p.fingering, [exercise.id]: event.target.checked } }))} /> Show suggested string &amp; finger</label>
    </div>
    <details className="help"><summary>Reading this exercise</summary><dl>
      {exercise.instructions?.length ? <><dt>This exercise</dt>{exercise.instructions.map(line => <dd key={line}>{line}</dd>)}</> : null}
      {durations.has('w') && <><dt>Whole note</dt><dd>An open oval with no stem. In 4/4 it lasts a whole measure: four beats.</dd></>}
      {durations.has('h') && <><dt>Half note</dt><dd>An open oval with a stem. It lasts two beats, so two half notes fill a 4/4 measure.</dd></>}
      <dt>Quarter-note beat</dt><dd>The steady pulse you count: “1, 2, 3, 4”. In 4/4 each quarter note gets one beat.</dd>
      <dt>4/4 time</dt><dd>The top 4 means four beats per measure; the bottom 4 means the quarter note gets the beat. Bar lines mark each measure.</dd>
      <dt>Tempo (BPM)</dt><dd>Beats per minute. “♩ = 60” means one beat per second. Lower numbers are slower. In guided practice the count for each note starts once your pitch is steady.</dd>
      {exercise.keySignature !== 'C' ? <><dt>Key signature</dt><dd>The sharps after the clef: {KEY_NAMES[exercise.keySignature]}. They apply to every note with that letter, in every octave, unless a natural sign (♮) cancels them.</dd></> : <><dt>Sharp sign (♯)</dt><dd>A ♯ before a note raises it a half step. It lasts until the next bar line.</dd></>}
      <dt>Fingering hints</dt><dd>“D↑2” means D string, high second finger. 0 is the open string. These are suggestions — the app hears pitch only and cannot tell which string or finger you used.</dd>
      <dt>Flat and sharp intonation</dt><dd>Flat means your pitch is lower than the written note; sharp means higher. Cents measure the gap: 100 cents is one half step.</dd>
    </dl></details>
    <details className="diagnostics"><summary>Developer diagnostics</summary><dl><dt>Raw frequency</dt><dd>{reading?.rawHz?.toFixed(1) ?? '—'} Hz</dd><dt>Smoothed frequency</dt><dd>{reading?.smoothHz?.toFixed(1) ?? '—'} Hz</dd><dt>Clarity</dt><dd>{reading?.clarity.toFixed(3) ?? '—'}</dd><dt>Input level (RMS)</dt><dd>{reading?.rms.toFixed(4) ?? '—'}</dd><dt>Estimated note</dt><dd>{reading?.smoothHz ? frequencyToNote(reading.smoothHz, a4) : '—'}</dd><dt>Target deviation</dt><dd>{cents?.toFixed(1) ?? '—'} cents</dd><dt>Phase / state</dt><dd>{evaluation.phase} / {evaluation.state}</dd><dt>Match / hold</dt><dd>{Math.round(evaluation.stableMs)} ms / {Math.round(evaluation.holdMs)} of {Math.round(evaluation.requiredMs)} ms</dd><dt>Hold fault time</dt><dd>{Math.round(evaluation.faultMs)} ms</dd><dt>Sample rate</dt><dd>{audioDetails?.sampleRate ?? '—'} Hz</dd><dt>AudioContext</dt><dd>{audioDetails?.contextState ?? 'unavailable'}</dd><dt>Requested processing</dt><dd>Echo: off · Noise: off · Gain: off</dd><dt>Applied track settings</dt><dd>{audioDetails?.applied ? JSON.stringify(audioDetails.applied) : 'Unavailable'}</dd></dl></details>
  </section>;
}
