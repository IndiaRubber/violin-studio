import { useEffect, useRef, useState } from 'react';
import { AudioSession, type AudioDiagnostics } from './audio';
import type { PitchReading } from './pitch';
import { centsFromTarget } from './music';
import { classifyString, formatCents, MAX_A4, MIN_A4, nearestNote, referenceFrequency, TUNER_IN_TUNE_CENTS, TunerPresentation, VIOLIN_STRINGS } from './tuner-logic';
import { validReference } from './reference';
import { TUNER_PITCH_SETTINGS } from './pitch';

export function Tuner({ onBack, a4, onReferenceChange }: { onBack: () => void; a4: number; onReferenceChange: (value: number) => void }) {
  const [mode, setMode] = useState<'violin' | 'chromatic'>('violin');
  const [stringId, setStringId] = useState('a4');
  const [a4Text, setA4Text] = useState(String(a4));
  const [referenceError, setReferenceError] = useState('');
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [displayHz, setDisplayHz] = useState<number | null>(null);
  const [details, setDetails] = useState<AudioDiagnostics | null>(null);
  const session = useRef<AudioSession | null>(null);
  const filter = useRef(new TunerPresentation());
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    session.current?.stop(); session.current = null;
    filter.current.reset();
    setListening(false); setStarting(false); setReading(null); setDisplayHz(null); setDetails(null);
  };
  useEffect(() => () => { generation.current++; session.current?.stop(); }, []);
  const start = async () => {
    if (session.current) return;
    setError(''); setStarting(true);
    const token = ++generation.current;
    const audio = new AudioSession(next => {
      if (token !== generation.current) return;
      setReading(next);
      setDisplayHz(filter.current.next(next));
    }, message => {
      if (token !== generation.current) return;
      session.current = null; filter.current.reset(); setDisplayHz(null); setListening(false);
      setError(message ?? 'Microphone input stopped. Reconnect it and try again.');
    }, update => { if (token === generation.current) setDetails(update); }, TUNER_PITCH_SETTINGS);
    session.current = audio;
    try {
      await audio.start();
      if (token === generation.current) setListening(true);
    } catch (cause) {
      if (token === generation.current) {
        session.current = null;
        const error = cause as Error;
        setError(error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in browser settings and try again.' : error.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : error.message || 'Could not start the microphone. Try again.');
      }
    }
    if (token === generation.current) setStarting(false);
  };
  const selected = VIOLIN_STRINGS.find(s => s.id === stringId)!;
  const detected = displayHz === null ? null : nearestNote(displayHz, a4);
  const targetHz = mode === 'violin' ? referenceFrequency(selected.midi, a4) : detected?.targetHz;
  const cents = displayHz !== null && targetHz !== undefined ? centsFromTarget(displayHz, targetHz) : null;
  const classification = displayHz === null ? null : classifyString(displayHz, stringId, a4);
  const inTune = cents !== null && (mode === 'chromatic' || classification?.kind === 'selected') && Math.abs(cents) <= TUNER_IN_TUNE_CENTS;
  const meterPosition = cents === null ? 50 : 50 + Math.max(-50, Math.min(50, cents));
  const status = !listening ? 'Start listening when you are ready.' : reading?.reason === 'quiet' ? 'Waiting for a note.' : reading?.reason === 'unsupported' ? 'Reliable pitch outside the supported range.' : reading?.reason === 'uncertain' || reading?.reason === 'outlier' ? 'Pitch uncertain — play a clearer note.' : !detected ? 'Listening for a note.' : mode === 'violin' ? classification!.message : inTune ? 'In tune' : cents! < 0 ? 'Flat — tune higher.' : 'Sharp — tune lower.';
  return <section className="tuner-screen">
    <button className="text-button" onClick={() => { stop(); onBack(); }}>← Home</button>
    <p className="eyebrow">Instrument tuner</p><h1>Tune your violin</h1>
    <div className="tuner-controls"><fieldset><legend>Mode</legend><div className="segmented"><button type="button" aria-pressed={mode === 'violin'} onClick={() => setMode('violin')}>Violin</button><button type="button" aria-pressed={mode === 'chromatic'} onClick={() => setMode('chromatic')}>Chromatic</button></div></fieldset><label className="reference-control">Concert pitch A4 <input aria-label="Concert pitch A4" aria-invalid={!!referenceError} type="number" min={MIN_A4} max={MAX_A4} step="1" value={a4Text} onChange={event => { const text = event.target.value; setA4Text(text); const value = Number(text); if (text && validReference(value)) { onReferenceChange(value); setReferenceError(''); } else setReferenceError(`Enter a whole number from ${MIN_A4} to ${MAX_A4} Hz.`); }} /> Hz</label></div>{referenceError && <p className="error" role="alert">{referenceError}</p>}
    {mode === 'violin' && <fieldset className="string-picker"><legend>Choose a string</legend><div>{VIOLIN_STRINGS.map(note => <button key={note.id} type="button" aria-pressed={stringId === note.id} onClick={() => setStringId(note.id)}>{note.name}<small>{referenceFrequency(note.midi, a4).toFixed(2)} Hz</small></button>)}</div></fieldset>}
    <div className="tuner-display"><p className="eyebrow">Detected note</p><strong className="tuner-note">{detected?.name ?? '—'}</strong><span className="tuner-frequency">{displayHz === null ? 'No reliable pitch' : `${displayHz.toFixed(2)} Hz`}</span><p className={`tuner-status ${inTune ? 'is-tuned' : ''}`} role="status">{status}</p><div className="tuner-cents">{cents === null ? '—' : formatCents(cents)}</div><div className="tuner-meter" role="img" aria-label={cents === null ? 'No pitch' : inTune ? 'In tune' : `${Math.abs(Math.round(cents))} cents ${cents < 0 ? 'flat' : 'sharp'}`}><span className="tuner-zone"/><span className="tuner-center"/>{cents !== null && <span className="tuner-needle" style={{ left: `${meterPosition}%` }}/>}</div><div className="tuner-labels"><span>Flat</span><span>In tune</span><span>Sharp</span></div></div>
    {error && <p className="error" role="alert">{error}</p>}<button className="primary" onClick={listening || starting ? stop : start}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button>
    <details className="diagnostics"><summary>Developer diagnostics</summary><dl><dt>Raw frequency</dt><dd>{reading?.rawHz?.toFixed(1) ?? '—'} Hz</dd><dt>Smoothed detector frequency</dt><dd>{reading?.smoothHz?.toFixed(1) ?? '—'} Hz</dd><dt>Display frequency</dt><dd>{displayHz?.toFixed(1) ?? '—'} Hz</dd><dt>Clarity / RMS</dt><dd>{reading ? `${reading.clarity.toFixed(3)} / ${reading.rms.toFixed(4)}` : '—'}</dd><dt>Detection state</dt><dd>{reading?.reason ?? 'off'}</dd><dt>Sample rate</dt><dd>{details?.sampleRate ?? '—'} Hz</dd><dt>AudioContext</dt><dd>{details?.contextState ?? 'unavailable'}</dd><dt>Requested processing</dt><dd>Echo: off · Noise: off · Gain: off</dd><dt>Applied track settings</dt><dd>{details?.applied ? JSON.stringify(details.applied) : 'Unavailable'}</dd></dl></details>
  </section>;
}
