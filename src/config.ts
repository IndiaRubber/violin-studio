export const PRACTICE = {
  toleranceCents: 25,
  stableMs: 350,
  minRms: 0.012,
  minClarity: 0.86,
  minFrequency: 160,
  maxFrequency: 800,
  analysisSize: 4096,
  pollMs: 50,
  maxGapMs: 110,
  releaseMs: 180,
  transitionMs: 50,
  contextResumeTimeoutMs: 1500,
  maxRejectedFrames: 2,
  maxRawSmoothCents: 25,
} as const;

/**
 * Sustained-note (whole note) policy. Phase A reuses PRACTICE.toleranceCents and
 * PRACTICE.stableMs to find the pitch. Phase B then counts the written duration:
 * - holdToleranceCents: a slightly wider band while sustaining, so normal beginner
 *   drift does not break the note. The meter still shows the exact deviation.
 * - holdGraceMs: any continuous stretch without a verified in-tolerance pitch
 *   (silence, uncertain frames, wrong pitch, or no readings at all) up to this
 *   length is tolerated and the beat count continues. A longer stretch resets the
 *   current note to Phase A. Earlier notes are never lost.
 * - maxFaultFraction: total tolerated fault time may not exceed this fraction of
 *   the whole note; beyond it the current note resets (mostly off-pitch holds fail).
 * - Completion requires the full duration AND a fresh verified matching reading,
 *   so a dropout or stale estimate at the end cannot complete a note.
 */
export const SUSTAIN = {
  holdToleranceCents: 35,
  holdGraceMs: 450,
  maxFaultFraction: 0.25,
} as const;

/** Reference tone playback. The microphone result is ignored while it plays and for settleMs afterwards. */
export const REFERENCE_TONE = {
  durationMs: 1600,
  attackMs: 60,
  releaseMs: 250,
  peakGain: 0.18,
  settleMs: 400,
} as const;
