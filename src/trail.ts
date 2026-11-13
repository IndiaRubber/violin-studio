// Time-based pitch trail for the tuner. Pure logic: callers pass timestamps, so the
// trail is deterministic in tests and moves at a steady speed regardless of when
// readings arrive. Horizontal position is cents relative to the active target.

export const TRAIL_WINDOW_MS = 3000;
/** A reading older than this is no longer shown as live. */
export const LIVE_MS = 250;
/** Two valid points further apart than this are not joined (missed readings = gap). */
export const MAX_JOIN_MS = 200;
/** Cents shown from the centre line to either edge of the graph. */
export const TRAIL_RANGE_CENTS = 50;

export interface TrailPoint { t: number; cents: number }
export interface PlotPoint { x: number; y: number; age: number; cents: number; opacity: number }

/** Horizontal position: flat left, sharp right, clamped to the graph edges. */
export function centsToX(cents: number, width: number, range = TRAIL_RANGE_CENTS): number {
  const clamped = Math.max(-range, Math.min(range, cents));
  return width / 2 + (clamped / range) * (width / 2);
}
/** Vertical position: newest at the top, oldest (window end) at the bottom. */
export function ageToY(age: number, height: number, windowMs = TRAIL_WINDOW_MS): number {
  return Math.max(0, Math.min(1, age / windowMs)) * height;
}
/** Fades linearly with age, fully transparent at the end of the window. */
export function ageOpacity(age: number, windowMs = TRAIL_WINDOW_MS): number {
  return Math.max(0, 1 - age / windowMs);
}

export class PitchTrail {
  private segments: TrailPoint[][] = [];
  private open = false;
  private key: string | null = null;
  constructor(private windowMs = TRAIL_WINDOW_MS) {}

  get target() { return this.key; }

  /** A new target (string, note, or mode) starts an empty trail. */
  setTarget(key: string | null) {
    if (key === this.key) return;
    this.key = key;
    this.clear();
  }

  /** Adds a reading. `null` = silence, uncertain input, or a note that is not the target: leaves a gap. */
  push(t: number, cents: number | null) {
    if (cents === null || !Number.isFinite(cents) || this.key === null) { this.open = false; return; }
    const current = this.segments.at(-1);
    const previous = current?.at(-1);
    if (!this.open || !current || !previous || t - previous.t > MAX_JOIN_MS || t < previous.t) this.segments.push([{ t, cents }]);
    else current.push({ t, cents });
    this.open = true;
  }

  clear() { this.segments = []; this.open = false; }

  /** Drops points older than the window. */
  prune(now: number) {
    const oldest = now - this.windowMs;
    this.segments = this.segments.map(segment => segment.filter(point => point.t >= oldest)).filter(segment => segment.length > 0);
    if (!this.segments.length) this.open = false;
  }

  /** The newest point, only if the latest input was valid and recent. */
  live(now: number): TrailPoint | null {
    if (!this.open) return null;
    const last = this.segments.at(-1)?.at(-1);
    return last && now - last.t <= LIVE_MS && now >= last.t ? last : null;
  }

  pointCount() { return this.segments.reduce((sum, segment) => sum + segment.length, 0); }

  /** Screen geometry for drawing: one polyline per contiguous segment. */
  geometry(now: number, width: number, height: number): PlotPoint[][] {
    this.prune(now);
    return this.segments.map(segment => segment.map(point => {
      const age = Math.max(0, now - point.t);
      return { x: centsToX(point.cents, width), y: ageToY(age, height, this.windowMs), age, cents: point.cents, opacity: ageOpacity(age, this.windowMs) };
    }));
  }
}
