import { PRACTICE } from './config';
import { PitchPipeline, type PitchReading, type PitchSettings } from './pitch';

export interface AudioDiagnostics { requested: MediaTrackConstraints; applied: MediaTrackSettings | null; sampleRate: number | null; contextState: AudioContextState | 'unavailable'; }
const REQUESTED: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export class AudioSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private stopped = false;
  private resumeAttempt: Promise<void> | null = null;
  constructor(private onReading: (reading: PitchReading, time: number) => void, private onLost: (message?: string) => void, private onDiagnostics: (details: AudioDiagnostics) => void = () => {}, private pitchSettings?: PitchSettings) {}
  private report() {
    const track = this.stream?.getAudioTracks()[0];
    this.onDiagnostics({ requested: REQUESTED, applied: track?.getSettings?.() ?? null, sampleRate: this.context?.sampleRate ?? null, contextState: this.context?.state ?? 'unavailable' });
  }
  private async ensureRunning() {
    if (!this.context) return;
    if (this.resumeAttempt) return this.resumeAttempt;
    const context = this.context;
    this.resumeAttempt = this.resumeContext(context);
    try { await this.resumeAttempt; } finally { this.resumeAttempt = null; }
  }
  private async resumeContext(context: AudioContext) {
    let timeout: number | undefined;
    try {
      await Promise.race([context.resume(), new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error('Audio could not start. Check browser audio permissions and try again.')), PRACTICE.contextResumeTimeoutMs); })]);
      if (!this.stopped && context.state !== 'running') throw new Error('Audio is suspended. Check browser audio permissions and try again.');
    } finally { if (timeout !== undefined) window.clearTimeout(timeout); this.report(); }
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('Microphone audio is unavailable in this browser. Use a current Chrome or Edge on localhost or HTTPS.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: REQUESTED, video: false });
      if (this.stopped) { this.stream.getTracks().forEach(track => track.stop()); return; }
      this.context = new AudioContext();
      await this.ensureRunning();
      if (this.stopped) { this.stop(); return; }
      this.source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = PRACTICE.analysisSize;
      this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser);
      const samples = new Float32Array(PRACTICE.analysisSize);
      const pipeline = new PitchPipeline(PRACTICE.analysisSize, this.pitchSettings);
      this.stream.getAudioTracks().forEach(track => { track.onended = () => { if (!this.stopped) { this.stop(); this.onLost(); } }; });
      this.timer = window.setInterval(() => {
        if (!this.analyser || !this.context || this.context.state === 'closed') return;
        if (this.context.state !== 'running') {
          void this.ensureRunning().catch(error => { if (!this.stopped) { this.stop(); this.onLost(error instanceof Error ? error.message : 'Audio stopped. Try again.'); } });
          return;
        }
        this.analyser.getFloatTimeDomainData(samples);
        this.onReading(pipeline.process(samples, this.context.sampleRate), performance.now());
      }, PRACTICE.pollMs);
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop() {
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.source?.disconnect();
    this.analyser?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.stream = null; this.source = null; this.analyser = null; this.context = null;
    this.report();
  }
}
