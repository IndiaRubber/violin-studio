import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Metronome } from './metronome';
import { clampTempo, DEFAULT_BPM, MAX_BPM, MIN_BPM, TEMPO_STEP } from './tempo';

/** A shared toolbar control. A supplied tempo is owned by the exercise's existing settings. */
export function PracticeMetronome({ tempo, blocked = false, complete = false }: {
  tempo?: number; blocked?: boolean; complete?: boolean;
}) {
  const [trainerTempo, setTrainerTempo] = useState(DEFAULT_BPM);
  const bpm = tempo ?? trainerTempo;
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [sound, setSound] = useState(true);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const settingsId = useId();
  const group = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const controller = useRef<Metronome | null>(null);

  useLayoutEffect(() => { controller.current?.setTempo(bpm); }, [bpm]);
  useLayoutEffect(() => { controller.current?.setBlocked(blocked); }, [blocked]);

  useEffect(() => {
    const stop = () => { controller.current?.stop(); setRunning(false); };
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
      controller.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !group.current?.contains(event.target)) setSettings(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [settings]);

  useLayoutEffect(() => {
    if (complete) { controller.current?.stop(); setRunning(false); setSettings(false); }
  }, [complete]);

  function toggle() {
    if (running) { controller.current?.stop(); setRunning(false); return; }
    setError('');
    controller.current ??= new Metronome(setPulse, () => {
      setSound(false);
      setError('Click audio unavailable. The visual metronome is still running.');
    });
    controller.current.setBlocked(blocked);
    controller.current.start(bpm, sound);
    setRunning(true);
  }

  return <div ref={group} className="practice-metronome" role="group" aria-label="Practice metronome" onKeyDown={event => {
    if (settings && event.key === 'Escape') { setSettings(false); settingsButton.current?.focus(); }
  }}>
    <button type="button" className="secondary metronome-toggle" aria-label="Metronome" aria-pressed={running} title={running ? 'Stop metronome' : 'Start metronome'}
      data-pulse={running && pulse} disabled={complete} onClick={toggle}>
      <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 21 3.6-16.5h6.8L19 21ZM6.4 16h11.2M12 16l6-13" /><path d="m15.6 7.9 2 1" />
      </svg>
    </button>
    <button type="button" className="secondary metronome-bpm" aria-label={`Metronome settings, ${bpm} BPM`} title="Metronome settings" aria-expanded={settings}
      aria-controls={settings ? settingsId : undefined} disabled={complete} ref={settingsButton} onClick={() => setSettings(value => !value)}>
      <span>{bpm}<small>BPM</small></span>
    </button>
    {settings && <div className="metronome-settings" id={settingsId} role="group" aria-label="Metronome settings">
      {tempo === undefined ? <div className="stepper">
        <button type="button" aria-label="Slower metronome" onClick={() => setTrainerTempo(clampTempo(bpm - TEMPO_STEP))} disabled={bpm <= MIN_BPM}>−</button>
        <output aria-label="Metronome tempo">{bpm} BPM</output>
        <button type="button" aria-label="Faster metronome" onClick={() => setTrainerTempo(clampTempo(bpm + TEMPO_STEP))} disabled={bpm >= MAX_BPM}>+</button>
      </div> : <p>Follows this exercise’s tempo.</p>}
      <label><input type="checkbox" checked={sound} onChange={event => {
        const audible = event.target.checked;
        setError(''); setSound(audible); controller.current?.setAudible(audible);
      }} /> Click sound</label>
      {error && <p role="status">{error}</p>}
    </div>}
    {!settings && error && <span className="metronome-notice" role="status">{error}</span>}
  </div>;
}
