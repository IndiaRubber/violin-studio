import type { PatternGroup } from './curriculum';
import { patternRange } from './pattern';

/** An optional relative-spacing sketch, never a ruler for exact placement. */
function FingerboardStrip({ group }: { group: PatternGroup }) {
  const positions = group.closePair === '2–3' ? [7, 36, 70, 79] : [7, 36, 45, 79];
  return <details className="fingerboard-details"><summary>Show relative finger spacing</summary>
    <div className="fingerboard-strip" role="img" aria-label={`${group.string} string: fingers ${group.closePair} close together; relative spacing only`}>
      <span className="fingerboard-line" aria-hidden="true" />
      {positions.map((left, finger) => <span key={finger} className="fingerboard-finger" style={{ left: `${left}%` }}>{finger}</span>)}
    </div>
    <small>Fingers {group.closePair} close. This sketch shows relative spacing, not exact finger placement.</small>
  </details>;
}

export function PatternGuide({ groups, active, onHear, playing }: { groups: PatternGroup[]; active: PatternGroup | null; onHear: () => void; playing: boolean }) {
  const current = active ?? groups[0];
  return <section className="pattern-guide" aria-label="Finger pattern cue">
    <div className="pattern-guide-top"><div><p className="eyebrow">Look ahead</p><strong>{current.title}</strong><p>{current.cue}</p></div>
      <button type="button" className="secondary" onClick={onHear} aria-pressed={playing}>{playing ? 'Stop pattern' : 'Hear pattern'}</button></div>
    {groups.length > 1 && <ol className="pattern-group-list">{groups.map(group => <li key={group.start} className={group === active ? 'active' : ''}>{group.title} · {patternRange(group)}</li>)}</ol>}
    <FingerboardStrip group={current} />
  </section>;
}
