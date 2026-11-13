import { useEffect, useRef, useState } from 'react';
import { AudioSession, type AudioDiagnostics } from './audio';
import type { PitchReading } from './pitch';
import { TUNER_PITCH_SETTINGS } from './pitch';
import { validReference } from './reference';
import { centsToX, PitchTrail, TRAIL_RANGE_CENTS } from './trail';
import { formatCents, MAX_A4, MIN_A4, referenceFrequency, TUNER_IN_TUNE_CENTS, TunerPresentation, tunerReadout, VIOLIN_STRINGS, type TunerMode, type TunerReadout } from './tuner-logic';
import { ViolinScroll } from './ViolinScroll';

const UI_INTERVAL_MS = 100;
const EMPTY: TunerReadout = { targetKey: null, peg: null, hearing: null, cents: null, direction: null, mismatch: null };
/** Trail colour by distance from the target (text always carries the same meaning). */
const trailColor = (cents: number) => Math.abs(cents) <= TUNER_IN_TUNE_CENTS ? '#5fd39a' : Math.abs(cents) <= 25 ? '#e8c35c' : '#f08a5d';
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Tuner({ onBack, a4, onReferenceChange }: { onBack: () => void; a4: number; onReferenceChange: (value: number) => void }) {
  const [mode, setMode] = useState<TunerMode>('violin');
  const [auto, setAuto] = useState(false);
  const [stringId, setStringId] = useState('a4');
  const [a4Text, setA4Text] = useState(String(a4));
  const [referenceError, setReferenceError] = useState('');
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [displayHz, setDisplayHz] = useState<number | null>(null);
  const [readout, setReadout] = useState<TunerReadout>(EMPTY);
  const [details, setDetails] = useState<AudioDiagnostics | null>(null);
  const session = useRef<AudioSession | null>(null);
  const filter = useRef(new TunerPresentation());
  const trail = useRef(new PitchTrail());
  const generation = useRef(0);
  const autoPeg = useRef<string | null>(null);
  const published = useRef({ at: -Infinity, key: '' });
  const settings = useRef({ mode, auto, stringId, a4 });
  settings.current = { mode, auto, stringId, a4 };
  const surface = useRef<HTMLDivElement>(null);
  const graph = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const marker = useRef<HTMLDivElement>(null);

  /** Any change of what is being tuned starts a fresh trail and clears the live readout. */
  const resetTarget = () => { trail.current.clear(); trail.current.setTarget(null); autoPeg.current = null; filter.current.reset(); setReadout(EMPTY); setDisplayHz(null); };
  const stop = () => {
    generation.current++;
    session.current?.stop(); session.current = null;
    filter.current.reset();
    trail.current.push(performance.now(), null);
    setListening(false); setStarting(false); setReading(null); setDisplayHz(null); setDetails(null);
    setReadout(r => ({ ...EMPTY, peg: r.peg, targetKey: r.targetKey }));
  };
  useEffect(() => () => { generation.current++; session.current?.stop(); }, []);

  // Draw the trail by elapsed time (requestAnimationFrame), independent of reading arrival.
  useEffect(() => {
    let frame = 0;
    let lastDraw = -Infinity;
    const reduced = prefersReducedMotion();
    graph.current?.setAttribute('data-reduced-motion', String(reduced));
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (reduced && now - lastDraw < 250) return; // reduced motion: a calm 4 updates per second
      lastDraw = now;
      const element = canvas.current, box = graph.current;
      if (!element || !box) return;
      const width = box.clientWidth, height = box.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) { element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); }
      const context = element.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const top = 34; // the live marker sits in the top band
      const segments = trail.current.geometry(now, width, height - top);
      context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round';
      for (const segment of segments) {
        if (segment.length === 1) {
          const [p] = segment;
          context.globalAlpha = p.opacity; context.fillStyle = trailColor(p.cents);
          context.beginPath(); context.arc(p.x, p.y + top, 2, 0, Math.PI * 2); context.fill();
        }
        for (let i = 1; i < segment.length; i++) {
          const a = segment[i - 1], b = segment[i];
          context.globalAlpha = b.opacity; context.strokeStyle = trailColor(b.cents);
          context.beginPath(); context.moveTo(a.x, a.y + top); context.lineTo(b.x, b.y + top); context.stroke();
        }
      }
      context.globalAlpha = 1;
      const live = trail.current.live(now);
      box.dataset.live = String(Boolean(live));
      box.dataset.points = String(trail.current.pointCount());
      box.dataset.segments = String(segments.length);
      box.dataset.liveCents = live ? live.cents.toFixed(1) : '';
      const pin = marker.current;
      if (pin) {
        pin.classList.toggle('is-live', Boolean(live));
        pin.classList.toggle('is-tuned', Boolean(live && Math.abs(live.cents) <= TUNER_IN_TUNE_CENTS));
        pin.style.left = `${live ? centsToX(live.cents, width) : width / 2}px`;
        const text = live ? `${live.cents > 0 ? '+' : ''}${Math.round(live.cents)}` : '';
        if (pin.textContent !== text) pin.textContent = text;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const start = async () => {
    if (session.current) return;
    setError(''); setStarting(true);
    const token = ++generation.current;
    const audio = new AudioSession((next, time) => {
      if (token !== generation.current) return;
      const hz = filter.current.next(next);
      const { mode: m, auto: a, stringId: s, a4: ref } = settings.current;
      const result = tunerReadout(hz, { mode: m, auto: a, selectedId: s, a4: ref, previousAuto: autoPeg.current });
      if (m === 'violin' && a && result.peg) autoPeg.current = result.peg;
      if (result.targetKey) trail.current.setTarget(result.targetKey);
      trail.current.push(time, result.cents);
      const key = `${result.targetKey}|${result.hearing}|${result.direction}|${result.mismatch}|${next.reason}`;
      if (key !== published.current.key || time - published.current.at >= UI_INTERVAL_MS) {
        published.current = { at: time, key };
        setReading(next); setDisplayHz(hz); setReadout(result);
      }
    }, message => {
      if (token !== generation.current) return;
      session.current = null; filter.current.reset(); trail.current.push(performance.now(), null); setDisplayHz(null); setListening(false);
      setReadout(r => ({ ...EMPTY, peg: r.peg, targetKey: r.targetKey }));
      setError(message ?? 'Microphone input stopped. Reconnect it and try again.');
    }, update => { if (token === generation.current) setDetails(update); }, TUNER_PITCH_SETTINGS);
    session.current = audio;
    try {
      await audio.start();
      if (token === generation.current) {
        setListening(true);
        if (window.innerHeight < 900) surface.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    } catch (cause) {
      if (token === generation.current) {
        session.current = null;
        const failure = cause as Error;
        setError(failure.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in browser settings and try again.' : failure.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : failure.message || 'Could not start the microphone. Try again.');
      }
    }
    if (token === generation.current) setStarting(false);
  };

  const chooseString = (id: string) => {
    if (mode === 'violin' && !auto && id === stringId) return;
    setMode('violin'); setAuto(false); setStringId(id); resetTarget();
    trail.current.setTarget(`string:${id}`);
  };
  const changeMode = (next: TunerMode) => { if (next !== mode) { setMode(next); resetTarget(); } };
  const toggleAuto = () => { setAuto(value => !value); resetTarget(); };

  const violin = mode === 'violin';
  const activePeg = violin ? (auto ? readout.peg : stringId) : null;
  const target = activePeg ? VIOLIN_STRINGS.find(s => s.id === activePeg)! : null;
  const quiet = !listening ? null : reading?.reason === 'quiet' ? (violin ? 'Play a string' : 'Play a note') : reading?.reason === 'unsupported' ? 'Pitch outside the supported range' : reading?.reason === 'uncertain' || reading?.reason === 'outlier' ? 'Pitch uncertain — play a clearer note' : null;
  const status = !listening ? (violin ? (auto ? 'Start, then play any open string' : `Start, then play the ${target!.name.replace(/\d/, '')} string`) : 'Start, then play a note')
    : readout.mismatch ?? readout.direction ?? quiet ?? 'Listening…';
  const statusKind = !listening || !readout.hearing ? 'idle' : readout.mismatch ? 'mismatch' : readout.direction === 'In tune' ? 'tuned' : 'adjust';
  const targetText = violin ? (target ? `Target ${target.name.replace(/\d/, '')} · ${referenceFrequency(target.midi, a4).toFixed(2)} Hz` : 'Auto · play any open string') : 'Chromatic · nearest note';

  return <section className="tuner-screen tuner-v2">
    <div className="tuner-top"><button className="text-button" onClick={() => { stop(); onBack(); }}>← Home</button><h1>Tune your violin</h1></div>
    <div className="tuner-surface" ref={surface}>
      <div className="tuner-bar">
        <div className="segmented dark" role="group" aria-label="Mode"><button type="button" aria-pressed={violin} onClick={() => changeMode('violin')}>Violin</button><button type="button" aria-pressed={!violin} onClick={() => changeMode('chromatic')}>Chromatic</button></div>
        {violin && <button type="button" role="switch" aria-checked={auto} className="auto-switch" onClick={toggleAuto}><span>Auto</span><span className="switch-track" aria-hidden="true"><span /></span></button>}
      </div>
      <div className="tuner-readout">
        <div><strong className="tuner-note" aria-label={readout.hearing ? `Hearing ${readout.hearing}` : 'No note'}>{readout.hearing ?? '—'}</strong><span className="tuner-frequency">{displayHz === null ? 'No reliable pitch' : `${displayHz.toFixed(1)} Hz`}</span></div>
        <div className="tuner-readout-right"><span className="tuner-cents">{readout.cents === null ? '—' : formatCents(readout.cents)}</span><span className="tuner-target">{targetText}</span></div>
      </div>
      <p className={`tuner-status is-${statusKind}`} role="status">{status}</p>
      <div className="tuner-graph" ref={graph} role="img" data-live="false" data-points="0"
        aria-label={readout.cents === null ? 'Pitch trail: no current reading' : `Pitch trail: ${readout.direction === 'In tune' ? 'in tune' : `${Math.abs(Math.round(readout.cents))} cents ${readout.cents < 0 ? 'flat' : 'sharp'}`}`}>
        <span className="graph-band" style={{ left: `${50 - (TUNER_IN_TUNE_CENTS / TRAIL_RANGE_CENTS) * 50}%`, width: `${(TUNER_IN_TUNE_CENTS / TRAIL_RANGE_CENTS) * 100}%` }} />
        <span className="graph-center" />
        <span className="graph-label flat" aria-hidden="true">♭ <small>flat</small></span><span className="graph-label sharp" aria-hidden="true"><small>sharp</small> ♯</span>
        <canvas ref={canvas} />
        <div className="trail-marker" ref={marker} aria-hidden="true" />
      </div>
      {violin ? <ViolinScroll active={activePeg} onSelect={chooseString} chromatic={false} a4={a4} />
        : <div className="chromatic-note"><p>Chromatic mode follows whatever note you play. Tap a string to tune the violin.</p><ViolinScroll active={null} onSelect={chooseString} chromatic a4={a4} /></div>}
      <button className="primary tuner-start" onClick={listening || starting ? stop : start}>{starting ? 'Connecting…' : listening ? 'Stop Listening' : 'Start Listening'}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="tuner-controls"><label className="reference-control">Concert pitch A4 <input aria-label="Concert pitch A4" aria-invalid={!!referenceError} type="number" min={MIN_A4} max={MAX_A4} step="1" value={a4Text} onChange={event => { const text = event.target.value; setA4Text(text); const value = Number(text); if (text && validReference(value)) { onReferenceChange(value); setReferenceError(''); resetTarget(); } else setReferenceError(`Enter a whole number from ${MIN_A4} to ${MAX_A4} Hz.`); }} /> Hz</label></div>{referenceError && <p className="error" role="alert">{referenceError}</p>}
    <details className="help tuner-help"><summary>How to read the trail</summary><p>The vertical line is the target pitch. Flat readings sit to the left, sharp to the right; the green band is “in tune” (±{TUNER_IN_TUNE_CENTS} cents). The newest reading is at the top and older ones drift down and fade over about three seconds, so you can see how the pitch moved. Gaps mean silence or an unclear sound. The tuner hears pitch only; it cannot tell which string you bowed.</p></details>
    <details className="diagnostics"><summary>Developer diagnostics</summary><dl><dt>Raw frequency</dt><dd>{reading?.rawHz?.toFixed(1) ?? '—'} Hz</dd><dt>Smoothed detector frequency</dt><dd>{reading?.smoothHz?.toFixed(1) ?? '—'} Hz</dd><dt>Display frequency</dt><dd>{displayHz?.toFixed(1) ?? '—'} Hz</dd><dt>Clarity / RMS</dt><dd>{reading ? `${reading.clarity.toFixed(3)} / ${reading.rms.toFixed(4)}` : '—'}</dd><dt>Detection state</dt><dd>{reading?.reason ?? 'off'}</dd><dt>Trail target</dt><dd>{readout.targetKey ?? '—'}</dd><dt>Sample rate</dt><dd>{details?.sampleRate ?? '—'} Hz</dd><dt>AudioContext</dt><dd>{details?.contextState ?? 'unavailable'}</dd><dt>Requested processing</dt><dd>Echo: off · Noise: off · Gain: off</dd><dt>Applied track settings</dt><dd>{details?.applied ? JSON.stringify(details.applied) : 'Unavailable'}</dd></dl></details>
  </section>;
}
