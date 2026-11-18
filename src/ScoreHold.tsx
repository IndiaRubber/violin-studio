import { holdSegments, pitchOffset, type HoldSample } from './score-hold';

export const HOLD_STAFF_HEIGHT = 178;
const BASELINE = 155;

export interface ScoreHoldDisplay {
  holding: boolean; progress: number; beats: number; beat: number; durationLabel: string;
  cents: number | null; samples: HoldSample[];
}

export function ScoreHold({ hold, start, end, width }: { hold: ScoreHoldDisplay; start: number; end: number; width: number }) {
  const x = (fraction: number) => start + (end - start) * fraction;
  const last = hold.samples.at(-1);
  return <svg className={`score-hold-graphic ${hold.holding ? 'is-holding' : ''}`} width={width} height={HOLD_STAFF_HEIGHT}
    viewBox={`0 0 ${width} ${HOLD_STAFF_HEIGHT}`} aria-hidden="true">
    <path className="score-hold-rail" d={`M${start} ${BASELINE}H${end}`} />
    <path className="score-hold-fill" d={`M${start} ${BASELINE}H${x(hold.progress)}`} />
    <circle className="score-hold-start" cx={start} cy={BASELINE} r={2.5} />
    {Array.from({ length: hold.beats }, (_, index) => {
      const fraction = (index + 1) / hold.beats;
      const tick = x(fraction);
      return <line key={index} className={`score-hold-beat${hold.progress >= fraction ? ' done' : ''}`}
        x1={tick} y1={BASELINE - (fraction === 1 ? 7 : 4)} x2={tick} y2={BASELINE + (fraction === 1 ? 7 : 4)} />;
    })}
    {holdSegments(hold.samples).filter(points => points.length > 1).map((points, i) =>
      <polyline className="score-hold-pitch" key={i} points={points.map(p => `${x(p.progress)},${BASELINE + pitchOffset(p.cents)}`).join(' ')} />)}
    {hold.holding && last && last.cents !== null && <circle className="score-hold-pitch-head"
      cx={x(last.progress)} cy={BASELINE + pitchOffset(last.cents)} r={3}
      data-cents={last.cents} />}
  </svg>;
}
