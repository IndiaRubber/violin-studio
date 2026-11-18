import { fingerLabel, POSITIONS, ROWS, ROW_LABELS, STRINGS, supported, type FingerboardMode, type Position } from './fingerboard';
import { spell } from './notation';

export function FingerboardChart({ mode, sequence, progress, target, a4, names, fingers, hintLevel, revealed, showPosition }: {
  mode: FingerboardMode; sequence: Position[]; progress: number; target: Position | undefined; a4: number;
  names: boolean; fingers: boolean; hintLevel: 'full' | 'partial' | 'memory'; revealed: boolean; showPosition: boolean;
}) {
  const complete = progress >= sequence.length;
  const completed = new Set(sequence.slice(0, progress).map(p => p.id));
  return <div className="fb-chart" role="table" aria-label="First-position violin fingerboard chart">
    <div className="fb-chart-head" role="row"><span role="columnheader">Position</span>{STRINGS.map(s => <span role="columnheader" key={s}>{s} string</span>)}</div>
    {ROWS.map(row => <div className="fb-chart-row" role="row" key={row}>
      <span className="fb-row-name" role="rowheader">{ROW_LABELS[row]}</span>
      {STRINGS.map(s => {
        const p = POSITIONS.find(item => item.string === s && item.row === row)!;
        const isTarget = !complete && target?.id === p.id;
        const active = isTarget && (mode === 'walk' || mode === 'staff' && showPosition || mode === 'find' && revealed);
        const done = completed.has(p.id);
        const available = supported(p, a4);
        const visibleName = mode === 'find' ? names && hintLevel === 'full' || done || revealed && isTarget : names || done;
        const accessibleName = mode === 'find' && !visibleName ? 'hidden note' : spell(p.pitch);
        return <span role="cell" key={p.id} className={`fb-cell ${active ? 'active' : ''} ${done ? 'done' : ''} ${!available ? 'unavailable' : ''}`}
          aria-label={`${s} string ${fingerLabel(p)}, ${accessibleName}, ${!available ? 'outside microphone range' : active ? 'current target' : done ? 'completed' : 'available'}`}>
          <strong>{visibleName ? spell(p.pitch) : '·'}</strong>
          <small>{!available ? 'Out of range' : active ? 'Now' : done ? '✓ Done' : fingers && mode !== 'find' ? `${p.finger}` : ' '}</small>
        </span>;
      })}
    </div>)}
  </div>;
}
