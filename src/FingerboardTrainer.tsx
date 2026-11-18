import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioSession } from './audio';
import { REFERENCE_TONE } from './config';
import { asPracticeNote, combinedSequence, fingerLabel, positionHz, POSITIONS, shuffled, staffSequence, STRINGS, supported, walk, type FingerboardMode, type Position } from './fingerboard';
import { FingerboardChart } from './FingerboardChart';
import { centsFromTarget, frequencyToNote, type ViolinString } from './music';
import type { PitchReading } from './pitch';
import { PracticeSession } from './practice-session';
import { Staff } from './Staff';
import { ReferenceTonePlayer } from './tone';

type Scope = ViolinString | 'D+A';
const emptyReading: PitchReading = { rawHz: null, smoothHz: null, clarity: 0, rms: 0, note: null, reason: 'quiet' };
const modeLabel: Record<FingerboardMode, string> = { walk: 'Guided Fingerboard Walk', find: 'Find the Note', staff: 'Staff + Fingerboard' };
const errorText = (error: unknown) => error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in browser settings and try again.' : error instanceof Error ? error.message : 'Microphone unavailable. Check the input device and try again.';

export function FingerboardTrainer({ a4, onBack }: { a4: number; onBack: () => void }) {
  const [mode, setMode] = useState<FingerboardMode>('walk');
  const [string, setString] = useState<Scope>('D');
  const [second, setSecond] = useState<'low2' | 'high2'>('high2');
  const [scope, setScope] = useState<Scope>('D+A');
  const [seed, setSeed] = useState(1);
  const [names, setNames] = useState(true);
  const [fingers, setFingers] = useState(true);
  const [hintLevel, setHintLevel] = useState<'full' | 'partial' | 'memory'>('memory');
  const [showPosition, setShowPosition] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading>(emptyReading);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState('quiet');
  const [demo, setDemo] = useState(false);
  const [last, setLast] = useState<Position | null>(null);
  const audio = useRef<AudioSession | null>(null);
  const player = useRef<ReferenceTonePlayer | null>(null);
  const session = useRef<PracticeSession | null>(null);
  const generation = useRef(0);
  const toneGeneration = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFind = useRef<string | undefined>(undefined);
  const findPool = useMemo(() => POSITIONS.filter(p => (scope === 'D+A' ? p.string === 'D' || p.string === 'A' : p.string === scope) && p.row !== 'four' && supported(p, a4)), [scope, a4]);
  const sequence = useMemo(() => mode === 'walk' ? string === 'D+A' ? combinedSequence() : walk(string, second) : mode === 'staff' ? staffSequence() : shuffled(findPool, seed, previousFind.current).slice(0, 6), [mode, string, second, findPool, seed]);
  const notes = useMemo(() => sequence.map((p, i) => asPracticeNote(p, a4, i)), [sequence, a4]);
  const complete = progress >= sequence.length;
  const target = sequence[Math.min(progress, sequence.length - 1)];
  const targetHz = target ? positionHz(target, a4) : 0;
  const liveHz = reading.reason === 'ok' && state !== 'release' && !demo && listening && !complete ? reading.smoothHz : null;
  const cents = liveHz ? centsFromTarget(liveHz, targetHz) : null;

  const stopTone = () => {
    const wasPlaying = demo || player.current?.playing || settleTimer.current !== null;
    toneGeneration.current++;
    player.current?.dispose(); player.current = null;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    if (wasPlaying) session.current?.suppress(performance.now() + REFERENCE_TONE.settleMs);
    setDemo(false);
  };
  const stopListening = () => {
    generation.current++;
    audio.current?.stop(); audio.current = null;
    setListening(false); setStarting(false); setReading(emptyReading); setState('quiet');
  };
  const restart = () => {
    stopTone();
    const suppression = session.current?.suppressionEnd ?? -Infinity;
    session.current = new PracticeSession(notes, 'quick');
    if (suppression > performance.now()) session.current.suppress(suppression);
    setProgress(0); setState('quiet'); setLast(null); setReading(emptyReading); setRevealed(false);
  };
  useEffect(() => { restart(); }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { generation.current++; toneGeneration.current++; audio.current?.stop(); player.current?.dispose(); if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const start = async () => {
    if (starting || listening) return;
    setError(''); setStarting(true);
    const token = ++generation.current;
    const capture = new AudioSession((next, now) => {
      if (token !== generation.current) return;
      if (player.current?.playing) session.current?.suppress(now + REFERENCE_TONE.settleMs);
      const result = session.current?.evaluate(next, now);
      if (!result) return;
      setReading(next); setState(result.state);
      if (result.advanced) {
        setLast(sequence[result.index - 1]);
        setProgress(result.index);
        setRevealed(false);
      }
      if (result.complete) { capture.stop(); audio.current = null; setListening(false); }
    }, message => {
      if (token !== generation.current) return;
      audio.current = null; setListening(false); setReading(emptyReading); setState('quiet');
      session.current?.restartNote(); setError(message ?? 'Microphone input stopped. Reconnect it and try again.');
    });
    audio.current = capture;
    try { await capture.start(); if (token === generation.current) setListening(true); }
    catch (cause) { if (token === generation.current) { audio.current = null; setError(errorText(cause)); } }
    if (token === generation.current) setStarting(false);
  };
  const hear = async () => {
    if (!target) return;
    if (demo || player.current?.playing) { stopTone(); return; }
    player.current ??= new ReferenceTonePlayer();
    const token = ++toneGeneration.current;
    session.current?.suppress(performance.now() + REFERENCE_TONE.durationMs + REFERENCE_TONE.settleMs + 150);
    setDemo(true); setState('reference'); setReading(emptyReading);
    try {
      const duration = await player.current.play(targetHz, () => {
        if (token !== toneGeneration.current) return;
        session.current?.suppress(performance.now() + REFERENCE_TONE.settleMs);
        settleTimer.current = setTimeout(() => { if (token === toneGeneration.current) setDemo(false); }, REFERENCE_TONE.settleMs);
      });
      if (token === toneGeneration.current) session.current?.suppress(performance.now() + duration + REFERENCE_TONE.settleMs);
    } catch { if (token === toneGeneration.current) { setDemo(false); setError('The reference note could not play. Try again.'); } }
  };
  const changeMode = (next: FingerboardMode) => { if (mode !== next) { stopListening(); setMode(next); } };
  const changeScope = (next: Scope) => { if (scope !== next) { stopListening(); setScope(next); } };
  const nextFind = () => { previousFind.current = sequence.at(-1)?.id; setSeed(value => value + 1); };
  const status = complete ? 'Sequence complete. Repeat whenever you like.' : demo ? 'Reference tone playing or settling. Microphone paused.' : !listening ? 'Start listening when you are ready.' : state === 'release' ? 'Good. Release briefly before the next note.' : state === 'matching' ? 'That pitch is steady. Keep playing.' : state === 'wrong' ? 'Different pitch. Find the target and try again.' : state === 'quiet' ? 'Waiting for a clear note.' : state === 'uncertain' || state === 'outlier' ? 'Uncertain sound. Try a steady note.' : 'Play the target note.';

  return <section className="fingerboard-trainer">
    <div className="practice-heading"><button className="text-button" onClick={() => { stopTone(); stopListening(); onBack(); }}>← Exercises</button><span>Fingerboard Trainer</span></div>
    <h1>Find your notes on the fingerboard</h1>
    <p className="objective">The chart shows suggested first-position locations. The microphone checks pitch only; it cannot tell which string or finger you used.</p>
    <div className="segmented fb-modes" role="group" aria-label="Trainer mode">{(['walk', 'find', 'staff'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => changeMode(value)}>{modeLabel[value]}</button>)}</div>
    <div className="fb-settings">
      {mode === 'walk' && <><fieldset><legend>String</legend><div className="chips">{([...STRINGS, 'D+A'] as Scope[]).map(value => <button key={value} aria-pressed={string === value} disabled={value === 'E'} title={value === 'E' ? 'Some E-string notes exceed the current microphone range' : undefined} onClick={() => setString(value)}>{value}</button>)}</div></fieldset>{string !== 'D+A' && <fieldset><legend>Second finger</legend><div className="chips"><button aria-pressed={second === 'low2'} onClick={() => setSecond('low2')}>Low 2</button><button aria-pressed={second === 'high2'} onClick={() => setSecond('high2')}>High 2</button></div></fieldset>}</>}
      {mode === 'find' && <fieldset><legend>Find notes on</legend><div className="chips">{(['G', 'D', 'A', 'D+A'] as Scope[]).map(value => <button key={value} aria-pressed={scope === value} onClick={() => changeScope(value)}>{value}</button>)}</div></fieldset>}
      <label><input type="checkbox" checked={names} onChange={e => setNames(e.target.checked)} /> Show note names</label>
      <label><input type="checkbox" checked={fingers} onChange={e => setFingers(e.target.checked)} /> Show suggested fingers</label>
      {mode === 'find' && <fieldset><legend>Find hints</legend><div className="chips">{(['full', 'partial', 'memory'] as const).map(level => <button key={level} aria-pressed={hintLevel === level} onClick={() => setHintLevel(level)}>{level === 'full' ? 'Full labels' : level === 'partial' ? 'Partial hint' : 'Memory'}</button>)}</div></fieldset>}
      {mode === 'find' && <button className="secondary" onClick={() => setRevealed(true)}>Reveal current position</button>}
      {mode === 'staff' && <label><input type="checkbox" checked={showPosition} onChange={e => setShowPosition(e.target.checked)} /> Show target position</label>}
    </div>
    {mode === 'staff' && <div className="score-card"><div className="score-heading">Read the staff, then find its suggested position</div><Staff notes={notes} currentIndex={progress} keySignature="C" labels={notes.map((n, i) => names || i < progress ? n.name : i === progress ? 'Now' : '·')} fingering={fingers && showPosition ? sequence.map(p => `${p.string}${p.finger}`) : null} /></div>}
    <FingerboardChart mode={mode} sequence={sequence} progress={progress} target={target} a4={a4} names={names} fingers={fingers} hintLevel={hintLevel} revealed={revealed} showPosition={showPosition} />
    <p className="fb-chart-note" id="fb-spacing-info">Open notes sit above the nut. Below it, dots show relative fingertip spacing toward the bridge. Low 2 and high 2 are alternate spots for the same finger. “Out of range” means this microphone exercise cannot assess that pitch at A4 = {a4} Hz.</p>
    <div className="fb-progress"><strong>{complete ? 'Complete' : `Note ${progress + 1} of ${sequence.length}`}</strong><span>{progress} played</span></div>
    <div className="feedback-grid"><div className="feedback-card target-card"><div><p className="eyebrow">Target</p><strong>{target ? spellPosition(target) : '—'}</strong><small>{target ? mode === 'find' && !revealed && hintLevel === 'memory' || mode === 'staff' && !showPosition ? 'Find its place on the chart' : `${target?.string} string · ${fingers ? fingerLabel(target!) : 'suggested finger hidden'}` : ''}</small></div><button className="tone-button" onClick={() => void hear()}>{demo ? 'Stop tone' : 'Hear note'}</button></div><div className="feedback-card"><p className="eyebrow">Detected</p><strong>{liveHz ? frequencyToNote(liveHz, a4) : '—'}</strong><small>{liveHz ? `${liveHz.toFixed(1)} Hz` : state === 'release' ? 'Waiting for next note' : listening ? 'Insufficient or uncertain signal' : 'Microphone off'}</small></div><div className="feedback-card meter-card"><p className="eyebrow">Intonation <strong>{cents === null ? '—' : `${Math.round(cents) > 0 ? '+' : ''}${Math.round(cents)} cents`}</strong></p><div className="meter"><span className="center-line"/><span className="meter-needle" style={{ left: `${50 + Math.max(-60, Math.min(60, cents ?? 0)) / 120 * 100}%` }}/></div><div className="meter-labels"><span>Flat</span><span>In tune</span><span>Sharp</span></div></div></div>
    <p className="status" role="status">{status}</p>{last && <p className="fb-last">Last played: {spellPosition(last)} · suggested {last.string} string, {fingerLabel(last)}.</p>}{error && <p role="alert" className="error">{error}</p>}
    <div className="actions"><button className="primary" onClick={listening || starting ? stopListening : start} disabled={complete}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button><button className="secondary" onClick={() => { session.current?.restartNote(); setState('quiet'); setReading(emptyReading); }}>Restart note</button><button className="secondary" onClick={restart}>Restart sequence</button>{complete && mode === 'find' && <button className="secondary" onClick={nextFind}>New shuffle</button>}</div>
    <details className="help"><summary>How this trainer works</summary><p>Play acoustic violin notes steadily and in tune. The same written pitch can be produced in more than one place, such as A4 on the D string with finger 4 or the open A string. Pitch alone cannot verify the chosen position. Hear note plays a synthesized reference at the current A4 setting. The microphone pauses during playback and for a short settling period.</p></details>
  </section>;
}

function spellPosition(p: Position) { return `${p.pitch.step}${p.pitch.accidental === '#' ? '♯' : p.pitch.accidental === 'b' ? '♭' : ''}${p.pitch.octave}`; }
