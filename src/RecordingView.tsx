import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EXERCISES, practiceNotes, type Exercise } from './curriculum';
import { Staff } from './Staff';
import { PerformanceRecorder } from './performance-recorder';
import { deleteRecording, saveRecording } from './recording-store';
import type { PracticeEvent } from './practice-history';

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function RecordingView({ controller, exercise, a4, onExerciseChange, onBack }: { controller: PerformanceRecorder; exercise: Exercise; a4: number; onExerciseChange: (id: string) => void; onBack: () => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const preview = useRef<HTMLVideoElement>(null);
  const playback = useRef<HTMLVideoElement>(null);
  const saveId = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => {
    if (!preview.current) return;
    preview.current.srcObject = state.stream;
    if (state.stream) void preview.current.play().catch(() => {});
    return () => { if (preview.current) preview.current.srcObject = null; };
  }, [state.stream, state.phase]);
  useEffect(() => {
    if (!state.blob || !playback.current) return;
    const url = URL.createObjectURL(state.blob);
    playback.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [state.blob, state.phase]);
  const download = () => {
    if (!state.blob) return;
    const url = URL.createObjectURL(state.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `violin-studio-${new Date().toISOString().replace(/[:.]/g, '-')}.${state.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const save = async () => {
    if (!state.blob || saving || state.savedId) return;
    const id = saveId.current ??= crypto.randomUUID();
    const completedAt = state.completedAt ?? new Date().toISOString();
    const event: PracticeEvent = { id: `recording-${id}`, type: 'recording', recordingId: id, exerciseId: exercise.id, title: `${exercise.title} recording`, completedAt, durationMs: state.durationMs };
    setSaving(true); controller.setError('');
    try {
      await saveRecording({ id, exerciseId: exercise.id, title: exercise.title, createdAt: completedAt, durationMs: state.durationMs, mimeType: state.mimeType, blob: state.blob }, event);
      controller.markSaved(id);
    } catch { controller.setError('Could not save locally. Your recording is still here; download it before leaving or retry Save.'); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (deleting || saving) return;
    setDeleting(true); controller.setError('');
    try {
      if (state.savedId) await deleteRecording(state.savedId, `recording-${state.savedId}`);
      saveId.current = null;
      controller.cancel(); onBack();
    } catch { controller.setError('Could not delete the saved recording. Try again.'); }
    finally { setDeleting(false); }
  };
  const leave = () => {
    if (saving || deleting) return;
    if (state.phase === 'review' && state.blob && !state.savedId) { setConfirmDiscard(true); return; }
    controller.cancel(); onBack();
  };
  const retry = () => {
    if (saving || deleting) return;
    if (state.blob && !state.savedId && !confirmDiscard) { setConfirmDiscard(true); return; }
    saveId.current = null; setConfirmDiscard(false); void controller.prepare();
  };
  const notes = practiceNotes(exercise, a4);
  return <section className="recording-view">
    <div className="practice-heading"><button className="text-button" onClick={leave} disabled={saving || deleting}>← {state.phase === 'review' ? 'Daily Practice' : 'Cancel recording'}</button><span>Record Performance</span></div>
    <h1>Record Performance</h1>
    {state.phase === 'preparing' && <p role="status">Opening front camera and microphone…</p>}
    {(state.phase === 'preview' || state.phase === 'countdown') && <>
      <p className="objective">Frame your violin and bow. Recording starts only after the countdown. The score will replace this large preview.</p>
      <label className="recording-score-choice">Score <select value={exercise.id} onChange={event => onExerciseChange(event.target.value)} disabled={state.phase === 'countdown'}>{EXERCISES.map(item => <option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select></label>
      <video className="camera-preview" ref={preview} muted playsInline autoPlay aria-label="Front camera preview" />
      {state.phase === 'preview' ? <div className="daily-actions"><button className="primary" onClick={() => controller.beginCountdown()}>Start recording</button><button className="secondary" onClick={() => { controller.cancel(); onBack(); }}>Cancel</button></div>
        : <div className="recording-countdown" role="status">Recording begins in {state.secondsLeft}… <button className="secondary" onClick={() => { controller.cancel(); onBack(); }}>Cancel</button></div>}
    </>}
    {state.phase === 'recording' && <>
      <div className="recording-bar" role="status"><strong>● Recording</strong><span>{seconds(state.elapsedMs)} / {seconds(controller.limitMs)}</span><button className="primary" onClick={() => controller.stop()}>Stop recording</button></div>
      <p className="objective">Read the score inside Violin Studio. Page buttons move the written score; pitch scoring is paused while the camera and microphone record.</p>
      <div className="score-card"><Staff notes={notes} currentIndex={-1} keySignature={exercise.keySignature} labels={notes.map(note => note.name)} allowPagePreview /></div>
    </>}
    {state.phase === 'review' && state.blob && <>
      <p className="objective">{exercise.title} · {seconds(state.durationMs)} recorded. {state.savedId ? 'Saved locally. Download a copy for backup.' : 'Not saved yet. Download a copy before leaving if storage fails.'}</p>
      <video className="recording-playback" ref={playback} controls playsInline aria-label="Recorded performance playback" />
      <div className="daily-actions"><button className="primary" onClick={() => void save()} disabled={saving || Boolean(state.savedId)}>{state.savedId ? 'Saved locally' : saving ? 'Saving…' : 'Save locally'}</button><button className="secondary" onClick={download}>Download / export</button><button className="secondary" onClick={() => void remove()} disabled={deleting || saving}>{deleting ? 'Deleting…' : 'Delete recording'}</button><button className="secondary" onClick={retry} disabled={saving}>Retry</button></div>
      {confirmDiscard && <div className="recording-confirm"><p>This take is not saved. Download it before discarding or retrying.</p><button className="secondary" onClick={download}>Download / export</button><button className="secondary" onClick={() => setConfirmDiscard(false)}>Keep this take</button><button className="secondary" onClick={() => { controller.cancel(); onBack(); }}>Discard and back</button><button className="secondary" onClick={() => { saveId.current = null; setConfirmDiscard(false); void controller.prepare(); }}>Discard and retry</button></div>}
    </>}
    {state.phase === 'error' && <div className="daily-actions"><button className="secondary" onClick={() => void controller.prepare()}>Try again</button><button className="secondary" onClick={onBack}>Back to Daily Practice</button></div>}
    {state.phase === 'idle' && <button className="primary" onClick={() => void controller.prepare()}>Prepare camera</button>}
    {state.error && <p className="error" role="alert">{state.error}</p>}
  </section>;
}
