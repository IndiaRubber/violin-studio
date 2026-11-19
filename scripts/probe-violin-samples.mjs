// Offline source-analysis aid. Usage: node scripts/probe-violin-samples.mjs <original AIFF> [...]
import { spawnSync } from 'node:child_process';
import { PitchDetector } from 'pitchy';

const rate = 32000, size = 4096, hop = 1600;
const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = hz => { const midi = Math.round(69 + 12 * Math.log2(hz / 440)); return names[(midi + 120) % 12] + (Math.floor(midi / 12) - 1); };
for (const file of process.argv.slice(2)) {
  const process = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', 'pipe:1'], { maxBuffer: 40_000_000 });
  if (process.status !== 0) throw new Error(process.stderr.toString());
  const bytes = process.stdout;
  const samples = new Float32Array(bytes.byteLength / 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getFloat32(i * 4, true);
  const detector = PitchDetector.forFloat32Array(size);
  const frames = [];
  for (let start = 0; start + size < samples.length; start += hop) {
    const slice = samples.subarray(start, start + size);
    const rms = Math.sqrt(slice.reduce((sum, value) => sum + value * value, 0) / size);
    const [hz, clarity] = detector.findPitch(slice, rate);
    frames.push({ at: start / rate, hz, clarity, rms, name: rms > .012 && clarity > .9 && hz > 150 && hz < 1200 ? nameOf(hz) : '-' });
  }
  const groups = [];
  for (const frame of frames) {
    const last = groups.at(-1);
    if (last?.name === frame.name && frame.at - last.end <= .051) { last.end = frame.at; last.hz.push(frame.hz); last.rms.push(frame.rms); }
    else groups.push({ name: frame.name, start: frame.at, end: frame.at, hz: [frame.hz], rms: [frame.rms] });
  }
  console.log(file);
  for (const group of groups.filter(g => g.name !== '-' && g.end - g.start > .4)) {
    const sorted = group.hz.toSorted((a, b) => a - b);
    console.log(`${group.name.padEnd(3)} ${group.start.toFixed(2)}–${group.end.toFixed(2)} s  ${sorted[Math.floor(sorted.length / 2)].toFixed(2)} Hz  ${group.rms[0].toFixed(3)} RMS`);
  }
}
