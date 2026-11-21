export type RecorderPhase = 'idle' | 'preparing' | 'preview' | 'countdown' | 'recording' | 'review' | 'error';
export interface RecorderSnapshot {
  phase: RecorderPhase;
  stream: MediaStream | null;
  blob: Blob | null;
  mimeType: string;
  secondsLeft: number;
  elapsedMs: number;
  durationMs: number;
  savedId: string | null;
  completedAt: string | null;
  error: string;
}
const EMPTY: RecorderSnapshot = { phase: 'idle', stream: null, blob: null, mimeType: '', secondsLeft: 0, elapsedMs: 0, durationMs: 0, savedId: null, completedAt: null, error: '' };
const TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const message = (error: unknown) => error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Allow access in browser settings and try again.' : error instanceof Error ? error.message : 'Camera or microphone unavailable. Check the device and try again.';

/** Kept by App above camera and score views; owns the only capture stream in recording mode. */
export class PerformanceRecorder {
  private snapshot: RecorderSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private generation = 0;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  constructor(readonly limitMs = 60_000) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<RecorderSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  private clearTimers() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.limitTimer) clearTimeout(this.limitTimer);
    if (this.ticker) clearInterval(this.ticker);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.countdownTimer = this.limitTimer = this.stopTimer = null;
    this.ticker = null;
  }
  private releaseStream() {
    const stream = this.stream;
    this.stream = null;
    if (stream) for (const track of stream.getTracks()) { track.onended = null; track.stop(); }
    this.update({ stream: null });
  }
  private fail(error: unknown) {
    this.generation++;
    this.clearTimers();
    try { if (this.recorder?.state === 'recording') this.recorder.stop(); } catch { /* capture already stopped */ }
    this.recorder = null; this.chunks = []; this.releaseStream();
    this.update({ phase: 'error', blob: null, error: message(error), secondsLeft: 0 });
  }
  async prepare() {
    this.cancel();
    const token = ++this.generation;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { this.fail(new Error('Camera and recording are not supported in this browser.')); return; }
    this.update({ phase: 'preparing', error: '' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (token !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) { stream.getTracks().forEach(track => track.stop()); throw new Error('Camera and microphone tracks are both required.'); }
      this.stream = stream;
      stream.getTracks().forEach(track => { track.onended = () => { if (token === this.generation) { if (this.snapshot.phase === 'recording') this.stop(); else this.fail(new Error('Camera or microphone input stopped. Try again.')); } }; });
      this.update({ phase: 'preview', stream });
    } catch (error) { if (token === this.generation) this.fail(error); }
  }
  beginCountdown() {
    if (this.snapshot.phase !== 'preview' || !this.stream) return;
    const token = this.generation;
    this.update({ phase: 'countdown', secondsLeft: 3 });
    const tick = (remaining: number) => {
      if (token !== this.generation) return;
      if (remaining === 0) { this.startCapture(token); return; }
      this.update({ secondsLeft: remaining });
      this.countdownTimer = setTimeout(() => tick(remaining - 1), 1000);
    };
    this.countdownTimer = setTimeout(() => tick(2), 1000);
  }
  private startCapture(token: number) {
    if (token !== this.generation || !this.stream) return;
    try {
      const mimeType = TYPES.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.recorder = recorder; this.chunks = [];
      recorder.ondataavailable = event => { if (token === this.generation && event.data.size > 0) this.chunks.push(event.data); };
      recorder.onerror = () => { if (token === this.generation) this.fail(new Error('Recording was interrupted. Try again.')); };
      recorder.onstop = () => {
        if (token !== this.generation) return;
        this.clearTimers();
        const durationMs = Math.min(this.limitMs, Math.max(0, performance.now() - this.startedAt));
        const blob = new Blob(this.chunks, { type: recorder.mimeType || mimeType || this.chunks[0]?.type || 'video/webm' });
        this.recorder = null; this.chunks = []; this.releaseStream();
        if (blob.size === 0) { this.update({ phase: 'error', blob: null, error: 'Recording was empty. Nothing was saved; please retry.' }); return; }
        this.update({ phase: 'review', blob, mimeType: blob.type, durationMs, elapsedMs: durationMs, completedAt: new Date().toISOString(), error: '', savedId: null });
      };
      recorder.start();
      this.startedAt = performance.now();
      this.update({ phase: 'recording', secondsLeft: 0, elapsedMs: 0, mimeType: recorder.mimeType || mimeType || '' });
      this.ticker = setInterval(() => this.update({ elapsedMs: Math.min(this.limitMs, performance.now() - this.startedAt) }), 250);
      this.limitTimer = setTimeout(() => this.stop(), this.limitMs);
    } catch (error) { this.fail(error); }
  }
  stop() {
    if (this.snapshot.phase !== 'recording' || !this.recorder) return;
    this.clearTimers();
    try {
      this.recorder.stop();
      if (this.snapshot.phase === 'recording') this.stopTimer = setTimeout(() => { if (this.snapshot.phase === 'recording') this.fail(new Error('Recording did not finish. Try again.')); }, 3000);
    } catch (error) { this.fail(error); }
  }
  markSaved(id: string) { if (this.snapshot.phase === 'review' && this.snapshot.blob) this.update({ savedId: id, error: '' }); }
  handleHidden() {
    if (this.snapshot.phase === 'recording') this.stop();
    else if (['preparing', 'preview', 'countdown'].includes(this.snapshot.phase)) this.cancel();
  }
  loadSaved(id: string, blob: Blob, mimeType: string, durationMs: number, completedAt: string) {
    this.cancel();
    this.update({ phase: 'review', blob, mimeType, durationMs, elapsedMs: durationMs, savedId: id, completedAt, error: '' });
  }
  setError(text: string) { this.update({ error: text }); }
  cancel() {
    this.generation++;
    this.clearTimers();
    const recorder = this.recorder;
    this.recorder = null; this.chunks = [];
    try { if (recorder?.state === 'recording') recorder.stop(); } catch { /* already stopped */ }
    this.releaseStream();
    this.update(EMPTY);
  }
}
