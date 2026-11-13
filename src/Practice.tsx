import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioSession, type AudioDiagnostics } from './audio';
import { REFERENCE_TONE } from './config';
import { centsFromTarget, frequencyToNote, OPEN_STRINGS } from './music';
import type { PitchReading } from './pitch';
import { exerciseNotes, initialPracticeEvaluation, PracticeSession, type PracticeMode, type StringFocus } from './practice-session';
import { loadPreferences, savePreferences } from './preferences';
import { scaledNotes } from './reference';
import { Staff } from './Staff';
import type { PracticeEvaluation, ResetReason } from './sustain';
import { clampTempo, MAX_BPM, MIN_BPM, TEMPO_STEP, wholeNoteMs, WHOLE_NOTE_BEATS } from './tempo';
import { ReferenceTonePlayer } from './tone';

export interface PracticeSummary { mode: PracticeMode; focus: StringFocus; tempo: number; notes: string[] }
const UI_INTERVAL_MS = 100; // the microphone polls every 50 ms; the UI only needs ~10 updates/s

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
    case 'holding': return `Hold it steady — beat ${evaluation.beat} of ${WHOLE_NOTE_BEATS}.`;
    case 'wavering': return 'Keep the bow moving and bring the pitch back to the note.';
    case 'matching': return mode === 'sustain' ? 'That’s the note — keep it steady…' : 'Hold it steady…';
    case 'wrong':
      if (reset) return 'The pitch moved away. Find the note again — no rush.';
      if (c !== null && Math.abs(c) <= 100) return c < 0 ? 'A little flat — move the pitch up.' : 'A little sharp — move the pitch down.';
      return 'Different note. Try the one on the staff.';
    case 'uncertain': case 'outlier': return reset ? 'The sound broke up. Find the note again — no rush.' : 'Uncertain sound. Try a clear, steady bow.';
    case 'quiet':
      if (reset === 'lost') return 'The sound stopped before four beats. Find the note again — no rush.';
      if (reset === 'unsteady') return 'The pitch wandered too much. Find it again and hold it steady.';
      return mode === 'sustain' ? 'Find the note on the staff. Take your time.' : 'Waiting for a note…';
    default: return 'Play the note on the staff.';
  }
}

export function Practice({ a4, onBack, onComplete, initialFocus = 'all' }: { a4: number; onBack: () => void; onComplete: (summary: PracticeSummary) => void; initialFocus?: StringFocus }) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const { mode, tempo, showHints } = prefs;
  useEffect(() => savePreferences(prefs), [prefs]);
  const [focus, setFocus] = useState<StringFocus>(initialFocus);
  const notes = useMemo(() => scaledNotes(exerciseNotes(focus), a4), [focus, a4]);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [evaluation, setEvaluation] = useState<PracticeEvaluation>(() => initialPracticeEvaluation(tempo));
  const [lastReset, setLastReset] = useState<ResetReason>(null);
  const [audioDetails, setAudioDetails] = useState<AudioDiagnostics | null>(null);
  const [toneState, setToneState] = useState<'idle' | 'playing' | 'settling'>('idle');
  const audio = useRef<AudioSession | null>(null);
  const practice = useRef(new PracticeSession(notes, mode, tempo));
  const player = useRef<ReferenceTonePlayer | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const published = useRef({ at: -Infinity, key: '' });
  const scoreCard = useRef<HTMLDivElement>(null);
  const summary = useRef<PracticeSummary>({ mode, focus, tempo, notes: [] });
  summary.current = { mode, focus, tempo, notes: notes.map(n => n.name) };

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
    setEvaluation(initialPracticeEvaluation(tempo)); setLastReset(null);
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
      publish(next, result, time);
      if (result.complete) {
        session.stop(); audio.current = null; setListening(false);
        onComplete(summary.current);
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

  const target = notes[Math.min(evaluation.index, notes.length - 1)];
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
    setPrefs(p => ({ ...p, tempo: next }));
    practice.current.setTempo(next);
    setEvaluation(e => ({ ...e, requiredMs: wholeNoteMs(next), ...(e.phase === 'hold' ? { phase: 'find' as const, holdMs: 0, beat: 0, state: 'quiet' as const } : {}) }));
  };
  const changeMode = (next: PracticeMode) => { if (next === mode) return; setPrefs(p => ({ ...p, mode: next })); restartExercise(notes, next); };
  const restartNote = () => { abandonHold(); setLastReset(null); };

  const sustain = mode === 'sustain';
  const cents = reading?.smoothHz && evaluation.state !== 'release' && evaluation.state !== 'reference' ? centsFromTarget(reading.smoothHz, target.frequency) : null;
  const meterCents = cents === null ? 0 : Math.max(-60, Math.min(60, cents));
  const holding = evaluation.phase === 'hold';
  const progress = holding ? Math.min(1, evaluation.holdMs / evaluation.requiredMs) : 0;
  const seconds = (wholeNoteMs(tempo) / 1000).toFixed(1).replace(/\.0$/, '');
  const feedback = guidance(evaluation, mode, listening, evaluation.phase === 'find' ? lastReset : null);
  const focusLabel = focus === 'all' ? 'Open strings' : `${OPEN_STRINGS.find(n => n.id === focus)!.name} string focus`;

  return <section className="practice">
    <div className="practice-heading"><button className="text-button" onClick={() => { stopListening(); onBack(); }}>← Exercises</button><span>Exercise 01 / {focusLabel}</span></div>
    <h1>Open Strings Practice</h1>
    <div className="progress-label"><span>Note {Math.min(evaluation.index + 1, notes.length)} of {notes.length}</span><span>{evaluation.index} complete</span></div>
    <div className="progress-track"><div style={{ width: `${evaluation.index / notes.length * 100}%` }} /></div>
    <div className="score-card" ref={scoreCard}>
      <div className="score-heading"><span>{sustain ? 'Hold each whole note for 4 beats' : 'Play this note'}</span><span className="mode-tag">{sustain ? `${tempo} BPM` : 'Quick check'}</span></div>
      <Staff notes={notes} currentIndex={evaluation.index} showHints={showHints} tempo={sustain ? tempo : undefined} />
    </div>
    <div className="feedback-grid">
      <div className="feedback-card target-card"><div><p className="eyebrow">Target</p><strong>{showHints ? target.name : '?'}</strong><small>{showHints ? `${target.frequency.toFixed(2)} Hz` : 'Read the staff'}</small></div>
        <button type="button" className={`tone-button ${toneState !== 'idle' ? 'is-playing' : ''}`} onClick={() => void playReference()} aria-pressed={toneState === 'playing'}><span aria-hidden="true">{toneState === 'playing' ? '■' : '♪'}</span>{toneState === 'playing' ? 'Stop' : 'Hear note'}</button></div>
      <div className="feedback-card"><p className="eyebrow">Detected</p><strong>{reading?.smoothHz && evaluation.state !== 'reference' ? frequencyToNote(reading.smoothHz, a4) : '—'}</strong><small>{evaluation.state === 'reference' ? 'Paused for reference' : reading?.reason === 'quiet' ? 'Insufficient signal' : reading?.reason === 'uncertain' || reading?.reason === 'outlier' ? 'Uncertain detection' : listening ? 'Listening' : 'Microphone off'}</small></div>
      <div className="feedback-card meter-card"><p className="eyebrow">Intonation <strong>{cents === null ? '—' : `${cents > 0 ? '+' : ''}${Math.round(cents)} cents`}</strong></p><div className="meter"><span className="center-line"/><span className="meter-needle" style={{ left: `${50 + meterCents / 120 * 100}%` }}/></div><div className="meter-labels"><span>Flat</span><span>In tune</span><span>Sharp</span></div></div>
    </div>
    {toneState !== 'idle' && <p className="tone-status" role="status">{toneState === 'playing' ? `♪ Playing the reference ${showHints ? target.name : 'note'} — microphone paused` : 'Microphone resuming…'}</p>}
    {sustain && <div className={`hold-card ${holding ? 'is-holding' : ''}`} aria-label={holding ? `Holding: beat ${evaluation.beat} of 4` : 'Hold not started'}>
      <div className="beats">{Array.from({ length: WHOLE_NOTE_BEATS }, (_, i) => <span key={i} className={`beat ${holding && i < evaluation.beat - 1 ? 'done' : ''} ${holding && i === evaluation.beat - 1 ? 'now' : ''}`}>{i + 1}</span>)}</div>
      <div className="hold-track"><div style={{ width: `${progress * 100}%` }} /></div>
      <small><span>{holding ? `Beat ${evaluation.beat} of 4${evaluation.state === 'wavering' ? ' · steady the pitch' : ''}` : 'Starts when the note is steady'}</span><span>4 beats = {seconds} s</span></small>
    </div>}
    <p className="status" role="status">{feedback}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button className="primary" onClick={listening || starting ? stopListening : start}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button><button className="secondary" aria-label="Restart note" onClick={restartNote}>↺ <span className="wide-only">Restart </span>note</button><button className="secondary" aria-label="Restart exercise" onClick={() => restartExercise()}>↺ <span className="wide-only">Restart </span>exercise</button></div>
    <div className="practice-options">
      <fieldset><legend>Practice mode</legend><div className="segmented"><button type="button" aria-pressed={sustain} onClick={() => changeMode('sustain')}>Sustain whole notes</button><button type="button" aria-pressed={!sustain} onClick={() => changeMode('quick')}>Quick check</button></div></fieldset>
      <fieldset className="tempo-control" disabled={!sustain}><legend>Tempo <span className="hint">(quarter-note beats per minute)</span></legend><div className="stepper"><button type="button" aria-label="Slower" onClick={() => changeTempo(tempo - TEMPO_STEP)} disabled={tempo <= MIN_BPM}>−</button><output aria-live="off" aria-label="Tempo">{tempo} BPM</output><button type="button" aria-label="Faster" onClick={() => changeTempo(tempo + TEMPO_STEP)} disabled={tempo >= MAX_BPM}>+</button></div></fieldset>
      <fieldset className="string-focus"><legend>Strings</legend><div className="chips">{(['all', ...OPEN_STRINGS.map(n => n.id)] as StringFocus[]).map(id => <button key={id} type="button" aria-pressed={focus === id} onClick={() => { if (focus !== id) setFocus(id); }}>{id === 'all' ? 'All' : OPEN_STRINGS.find(n => n.id === id)!.name}</button>)}</div></fieldset>
      <label className="hint-toggle"><input type="checkbox" checked={showHints} onChange={event => setPrefs(p => ({ ...p, showHints: event.target.checked }))} /> Show note names</label>
    </div>
    <details className="help"><summary>Reading this exercise</summary><dl>
      <dt>Whole note</dt><dd>An open oval with no stem. In 4/4 it lasts a whole measure: four beats.</dd>
      <dt>Quarter-note beat</dt><dd>The steady pulse you count: “1, 2, 3, 4”. In 4/4 each quarter note gets one beat.</dd>
      <dt>4/4 time</dt><dd>The top 4 means four beats per measure; the bottom 4 means the quarter note gets the beat. Bar lines mark each measure.</dd>
      <dt>Tempo (BPM)</dt><dd>Beats per minute. “♩ = 60” means one beat per second, so a whole note lasts 4 seconds. Lower numbers are slower.</dd>
      <dt>Flat and sharp</dt><dd>Flat means your pitch is lower than the written note; sharp means higher. Cents measure the gap: 100 cents is one half step.</dd>
      <dt>What the app hears</dt><dd>It checks pitch only. It cannot tell which string or finger you used, or judge bowing.</dd>
    </dl></details>
    <details className="diagnostics"><summary>Developer diagnostics</summary><dl><dt>Raw frequency</dt><dd>{reading?.rawHz?.toFixed(1) ?? '—'} Hz</dd><dt>Smoothed frequency</dt><dd>{reading?.smoothHz?.toFixed(1) ?? '—'} Hz</dd><dt>Clarity</dt><dd>{reading?.clarity.toFixed(3) ?? '—'}</dd><dt>Input level (RMS)</dt><dd>{reading?.rms.toFixed(4) ?? '—'}</dd><dt>Estimated note</dt><dd>{reading?.smoothHz ? frequencyToNote(reading.smoothHz, a4) : '—'}</dd><dt>Target deviation</dt><dd>{cents?.toFixed(1) ?? '—'} cents</dd><dt>Phase / state</dt><dd>{evaluation.phase} / {evaluation.state}</dd><dt>Match / hold</dt><dd>{Math.round(evaluation.stableMs)} ms / {Math.round(evaluation.holdMs)} of {Math.round(evaluation.requiredMs)} ms</dd><dt>Hold fault time</dt><dd>{Math.round(evaluation.faultMs)} ms</dd><dt>Sample rate</dt><dd>{audioDetails?.sampleRate ?? '—'} Hz</dd><dt>AudioContext</dt><dd>{audioDetails?.contextState ?? 'unavailable'}</dd><dt>Requested processing</dt><dd>Echo: off · Noise: off · Gain: off</dd><dt>Applied track settings</dt><dd>{audioDetails?.applied ? JSON.stringify(audioDetails.applied) : 'Unavailable'}</dd></dl></details>
  </section>;
}
