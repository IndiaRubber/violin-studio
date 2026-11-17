import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PitchDetector } from 'pitchy';
import { loadTunerSound, playbackRate, sampleForString, saveTunerSound, VIOLIN_SAMPLES, ViolinSamplePlayer } from './violin-samples';

function wav(path: string) {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  let offset = 12, sampleRate = 0, pcm: Float32Array | null = null;
  while (offset + 8 <= bytes.length) {
    const tag = bytes.toString('ascii', offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    if (tag === 'fmt ') {
      expect(view.getUint16(offset + 8, true)).toBe(1); // uncompressed PCM
      expect(view.getUint16(offset + 10, true)).toBe(1); // mono
      sampleRate = view.getUint32(offset + 12, true);
      expect(view.getUint16(offset + 22, true)).toBe(16);
    }
    if (tag === 'data') {
      pcm = new Float32Array(size / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(offset + 8 + i * 2, true) / 32768;
    }
    offset += 8 + size + (size % 2);
  }
  if (!pcm) throw new Error('Missing WAV data.');
  return { pcm, sampleRate };
}

describe('bundled bowed violin clips', () => {
  it('maps exactly four open strings and corrects the measured pitch at A440 and A442', () => {
    expect(Object.keys(VIOLIN_SAMPLES)).toEqual(['g3', 'd4', 'a4', 'e5']);
    expect(sampleForString('c5')).toBeNull();
    expect(sampleForString('toString')).toBeNull();
    for (const [id, target] of Object.entries({ g3: 196, d4: 440 * 2 ** (-7 / 12), a4: 440, e5: 440 * 2 ** (7 / 12) })) {
      const sample = sampleForString(id)!;
      for (const a4 of [440, 442]) {
        const hz = target * a4 / 440;
        expect(sample.measuredHz * playbackRate(hz, sample.measuredHz)).toBeCloseTo(hz, 8);
      }
    }
    expect(() => playbackRate(440, 0)).toThrow();
  });

  it('measures the steady part of every shipped file and checks level, duration, and pitch span', () => {
    const detector = PitchDetector.forFloat32Array(4096);
    let total = 0;
    for (const [id, sample] of Object.entries(VIOLIN_SAMPLES)) {
      const path = `public${sample.url}`;
      const { pcm, sampleRate } = wav(path);
      const pitches: number[] = [];
      for (let start = Math.round(0.16 * sampleRate); start + 4096 < Math.round(1.42 * sampleRate); start += 1600) {
        const [hz, clarity] = detector.findPitch(pcm.subarray(start, start + 4096), sampleRate);
        if (clarity >= 0.95) pitches.push(hz);
      }
      pitches.sort((a, b) => a - b);
      expect(pitches.length, id).toBeGreaterThan(20);
      expect(pitches[Math.floor(pitches.length / 2)], id).toBeCloseTo(sample.measuredHz, 1);
      expect(1200 * Math.log2(pitches.at(-1)! / pitches[0]), id).toBeLessThan(10);
      expect(pcm.length / sampleRate, id).toBeCloseTo(1.6, 2);
      const rms = Math.sqrt(pcm.reduce((sum, value) => sum + value * value, 0) / pcm.length);
      expect(rms, id).toBeGreaterThan(0.045);
      expect(rms, id).toBeLessThan(0.055);
      total += readFileSync(path).length;
    }
    expect(total).toBe(409912);
  });

  it('defaults to Tone and remembers Violin locally', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(loadTunerSound()).toBe('tone');
    saveTunerSound('violin');
    expect(loadTunerSound()).toBe('violin');
    vi.unstubAllGlobals();
  });

  it('cancels a pending decode before an audio source can start', async () => {
    let finishDecode!: (value: AudioBuffer) => void;
    const source = { buffer: null, playbackRate: { value: 1 }, onended: null, connect: vi.fn(() => ({ connect: vi.fn() })), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    const context = { state: 'running', currentTime: 0, destination: {}, resume: vi.fn(), close: vi.fn(async () => {}), decodeAudioData: vi.fn(() => new Promise<AudioBuffer>(resolve => { finishDecode = resolve; })), createBufferSource: vi.fn(() => source), createGain: vi.fn() };
    const player = new ViolinSamplePlayer(() => context as never, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response);
    const pending = player.play('a4', 440, vi.fn());
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
    player.dispose();
    finishDecode({ duration: 1.6 } as AudioBuffer);
    expect(await pending).toBe(0);
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
