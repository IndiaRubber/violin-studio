import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSession } from './audio';

afterEach(() => vi.unstubAllGlobals());
describe('audio session lifecycle', () => {
  it('stops media tracks, disconnects nodes and closes the context', async () => {
    const track = { stop: vi.fn(), onended: null as (() => void) | null };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const disconnectSource = vi.fn();
    const disconnectAnalyser = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    class FakeContext {
      state = 'running'; sampleRate = 48000;
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: disconnectSource });
      createAnalyser = () => ({ fftSize: 0, smoothingTimeConstant: 0, getFloatTimeDomainData: vi.fn(), disconnect: disconnectAnalyser });
    }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('window', { AudioContext: FakeContext, setInterval: vi.fn().mockReturnValue(7), clearInterval: vi.fn(), setTimeout, clearTimeout });
    vi.stubGlobal('AudioContext', FakeContext);
    const session = new AudioSession(vi.fn(), vi.fn());
    await session.start();
    session.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(disconnectSource).toHaveBeenCalledOnce();
    expect(disconnectAnalyser).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('closes the context and track when audio remains suspended', async () => {
    const track = { stop: vi.fn(), onended: null };
    const close = vi.fn().mockResolvedValue(undefined);
    class SuspendedContext {
      state = 'suspended'; sampleRate = 48000;
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
    }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] }) } });
    vi.stubGlobal('window', { AudioContext: SuspendedContext, setTimeout, clearTimeout });
    vi.stubGlobal('AudioContext', SuspendedContext);
    await expect(new AudioSession(vi.fn(), vi.fn()).start()).rejects.toThrow(/suspended/i);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('times out a resume that never settles and releases capture', async () => {
    vi.useFakeTimers();
    try {
      const track = { stop: vi.fn(), onended: null };
      const close = vi.fn().mockResolvedValue(undefined);
      class StalledContext {
        state = 'suspended'; sampleRate = 48000;
        resume = () => new Promise<void>(() => {});
        close = close;
      }
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] }) } });
      vi.stubGlobal('window', { AudioContext: StalledContext, setTimeout, clearTimeout });
      vi.stubGlobal('AudioContext', StalledContext);
      const start = new AudioSession(vi.fn(), vi.fn()).start();
      const failure = expect(start).rejects.toThrow(/could not start/i);
      await vi.advanceTimersByTimeAsync(1600);
      await failure;
      expect(track.stop).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
});
