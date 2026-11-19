// Offline preparation only. Original Iowa source files are never bundled.
// Usage: node scripts/prepare-violin-samples.mjs <directory-with-source-aiffs> [--fingered]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PitchDetector } from 'pitchy';

const openClips = [
  { id: 'g3', original: 'Violin.arco.mf.sulG.G3B3.aiff', start: 2.75 },
  { id: 'd4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 4.70 },
  { id: 'a4', original: 'Violin.arco.mf.sulA.A4B4.aiff', start: 5.45 },
  { id: 'e5', original: 'Violin.arco.mf.sulE.E5B5.aiff', start: 4.00 },
];
const fingeredClips = [
  { id: 'd-e4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 21.65 },
  { id: 'd-f4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 41.10 },
  { id: 'd-fs4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 51.30 },
  { id: 'd-g4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 61.10 },
  { id: 'd-a4', original: 'Violin.arco.mf.sulD.D4A4.aiff', start: 90.10 },
  { id: 'a-b4', original: 'Violin.arco.mf.sulA.A4B4.aiff', start: 23.40 },
  { id: 'a-c5', original: 'Violin.arco.mf.sulA.C5C6.aiff', start: 4.30 },
  { id: 'a-cs5', original: 'Violin.arco.mf.sulA.C5C6.aiff', start: 25.60 },
  { id: 'a-d5', original: 'Violin.arco.mf.sulA.C5C6.aiff', start: 34.80 },
];
const clips = process.argv.includes('--fingered') ? fingeredClips : openClips;
const duration = 1.60;
const sampleRate = 32000;
const output = resolve('public/samples');
const source = process.argv[2];
if (!source) throw new Error('Pass the directory containing the original Iowa AIFF files.');

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: 4_000_000 });
  if (result.status !== 0) throw new Error(result.stderr.toString() || 'ffmpeg failed');
  return result.stdout;
}

function decode(file, start) {
  const bytes = ffmpeg(['-ss', String(start), '-t', String(duration), '-i', file, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1']);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(bytes.length / 4);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getFloat32(i * 4, true);
  return samples;
}

function stats(samples) {
  let power = 0, peak = 0;
  for (const value of samples) { power += value * value; peak = Math.max(peak, Math.abs(value)); }
  return { rms: Math.sqrt(power / samples.length), peak };
}

function measuredPitch(samples) {
  const detector = PitchDetector.forFloat32Array(4096);
  const pitches = [];
  // Exclude attack/fades. Each overlapping window is 128 ms at 32 kHz.
  for (let start = Math.round(0.16 * sampleRate); start + 4096 < Math.round(1.42 * sampleRate); start += 1600) {
    const [hz, clarity] = detector.findPitch(samples.subarray(start, start + 4096), sampleRate);
    if (hz > 150 && hz < 800 && clarity >= 0.95) pitches.push(hz);
  }
  if (pitches.length < 12) throw new Error('Too few reliable pitch windows in sample.');
  pitches.sort((a, b) => a - b);
  const median = pitches[Math.floor(pitches.length / 2)];
  const spanCents = 1200 * Math.log2(pitches.at(-1) / pitches[0]);
  if (spanCents > 10) throw new Error(`Unsteady sample: ${spanCents.toFixed(1)} cents of pitch span.`);
  return { measuredHz: Number(median.toFixed(2)), spanCents: Number(spanCents.toFixed(2)), windows: pitches.length };
}

mkdirSync(output, { recursive: true });
for (const clip of clips) {
  const original = join(resolve(source), clip.original);
  const raw = decode(original, clip.start);
  const level = stats(raw);
  // RMS matching with a peak cap preserves natural dynamics and avoids clipping.
  const gain = Math.min(0.05 / level.rms, 0.85 / level.peak);
  const destination = join(output, `${clip.id}.wav`);
  ffmpeg(['-y', '-ss', String(clip.start), '-t', String(duration), '-i', original, '-ac', '1', '-ar', String(sampleRate), '-af', `volume=${gain},afade=t=in:st=0:d=0.04,afade=t=out:st=1.45:d=0.15`, '-c:a', 'pcm_s16le', destination]);
  const final = decode(destination, 0);
  console.log(JSON.stringify({ id: clip.id, original: clip.original, startSeconds: clip.start, durationSeconds: duration, gain: Number(gain.toFixed(3)), ...measuredPitch(final), ...stats(final) }));
}
