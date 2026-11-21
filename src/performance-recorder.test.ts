import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceRecorder } from './performance-recorder';

class Track { onended: (() => void) | null = null; stop = vi.fn(); }
class Stream {
  video = new Track(); audio = new Track();
  getTracks() { return [this.video, this.audio]; }
  getVideoTracks() { return [this.video]; }
  getAudioTracks() { return [this.audio]; }
}
class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported = vi.fn((type: string) => type === 'video/webm');
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'video/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['valid video'], { type: this.mimeType }) }); this.onstop?.(); });
  constructor() { Recorder.instances.push(this); }
}
beforeEach(() => { vi.useFakeTimers(); Recorder.instances = []; vi.stubGlobal('MediaRecorder', Recorder); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const setup = (stream = new Stream()) => {
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  return { stream, getUserMedia };
};

describe('performance capture lifecycle', () => {
  it('previews, waits three seconds, records for exactly one minute, and releases all tracks', async () => {
    const { stream, getUserMedia } = setup();
    const controller = new PerformanceRecorder();
    expect(controller.getSnapshot().phase).toBe('idle');
    expect(getUserMedia).not.toHaveBeenCalled();
    await controller.prepare();
    expect(controller.getSnapshot().phase).toBe('preview');
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: { facingMode: 'user' } }));
    controller.beginCountdown();
    await vi.advanceTimersByTimeAsync(2999);
    expect(Recorder.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getSnapshot().phase).toBe('recording');
    expect(Recorder.instances[0].start).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(Recorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ phase: 'review', durationMs: 60_000 });
    expect(controller.getSnapshot().completedAt).toBeTruthy();
    expect(controller.getSnapshot().blob?.size).toBeGreaterThan(0);
    expect(stream.video.stop).toHaveBeenCalledOnce();
    expect(stream.audio.stop).toHaveBeenCalledOnce();
  });
  it('cancels preview, countdown, active recording, and a late permission result', async () => {
    const { stream } = setup();
    const controller = new PerformanceRecorder();
    await controller.prepare(); controller.beginCountdown(); controller.cancel();
    await vi.advanceTimersByTimeAsync(4000);
    expect(Recorder.instances).toHaveLength(0);
    expect(stream.video.stop).toHaveBeenCalledOnce();
    const activeStream = new Stream(); setup(activeStream);
    await controller.prepare(); controller.beginCountdown(); await vi.advanceTimersByTimeAsync(3000);
    controller.cancel();
    expect(Recorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().phase).toBe('idle');
    expect(activeStream.audio.stop).toHaveBeenCalledOnce();
    let resolve!: (stream: Stream) => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<Stream>(done => { resolve = done; }) } });
    const pending = controller.prepare(); controller.cancel();
    const late = new Stream(); resolve(late); await pending;
    expect(late.video.stop).toHaveBeenCalledOnce();
    expect(late.audio.stop).toHaveBeenCalledOnce();
  });
  it('reports denial and empty recordings without retaining tracks or claiming a saved take', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
    const controller = new PerformanceRecorder();
    await controller.prepare();
    expect(controller.getSnapshot().error).toMatch(/permission was denied/);
    const { stream } = setup();
    await controller.prepare(); controller.beginCountdown(); await vi.advanceTimersByTimeAsync(3000);
    Recorder.instances[0].ondataavailable = null;
    controller.stop();
    expect(controller.getSnapshot().phase).toBe('error');
    expect(controller.getSnapshot().error).toMatch(/empty/);
    expect(stream.video.stop).toHaveBeenCalledOnce();
    expect(stream.audio.stop).toHaveBeenCalledOnce();
  });
  it('ends capture when hidden and cancels a hidden countdown', async () => {
    const { stream } = setup();
    const controller = new PerformanceRecorder();
    await controller.prepare(); controller.beginCountdown(); controller.handleHidden();
    await vi.advanceTimersByTimeAsync(3000);
    expect(Recorder.instances).toHaveLength(0);
    expect(stream.audio.stop).toHaveBeenCalledOnce();
    const second = new Stream(); setup(second);
    await controller.prepare(); controller.beginCountdown(); await vi.advanceTimersByTimeAsync(3000);
    controller.handleHidden();
    expect(controller.getSnapshot().phase).toBe('review');
    expect(second.video.stop).toHaveBeenCalledOnce();
  });
});
