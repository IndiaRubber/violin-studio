import type { CSSProperties } from 'react';
import { distanceFromNut, fingerLabel, position, ROWS, ROW_LABELS, STRINGS, supported, type FingerboardMode, type FingerRow, type Position } from './fingerboard';
import { spell } from './notation';

const stopSpan = distanceFromNut(position('D', 'four'));

export function FingerboardChart({ mode, sequence, progress, target, a4, names, fingers, hintLevel, revealed, showPosition }: {
  mode: FingerboardMode; sequence: Position[]; progress: number; target: Position | undefined; a4: number;
  names: boolean; fingers: boolean; hintLevel: 'full' | 'partial' | 'memory'; revealed: boolean; showPosition: boolean;
}) {
  const complete = progress >= sequence.length;
  const completed = new Set(sequence.slice(0, progress).map(p => p.id));
  const walkPositions = mode === 'walk' ? new Set(sequence.map(p => p.id)) : null;
  const hintShown = mode === 'walk' || mode === 'staff' && showPosition || mode === 'find' && revealed;
  const showNames = names && (mode !== 'find' || hintLevel === 'full');
  const shape = mode === 'walk' && target && fingers
    ? sequence.find(p => p.string === target.string && (p.row === 'low2' || p.row === 'high2'))?.row
    : undefined;

  const renderRow = (row: FingerRow) => (
    <div className={`fb-chart-row ${row === 'open' ? 'fb-open' : ''}`} role="row" key={row}>
      <span className="fb-row-name" role="rowheader" aria-label={fingers ? ROW_LABELS[row] : undefined}>{fingers ? ROW_LABELS[row] : ''}</span>
      {STRINGS.map(string => {
        const p = position(string, row);
        const active = !complete && target?.id === p.id && hintShown;
        const done = completed.has(p.id);
        const available = supported(p, a4);
        const visibleName = showNames || done || mode === 'find' && active;
        const dimmed = walkPositions !== null && !walkPositions.has(p.id);
        const label = [`${string} string`, fingers ? fingerLabel(p) : null, visibleName ? spell(p.pitch) : 'hidden note',
          !available ? 'outside microphone range' : null, active ? 'current target' : null, done ? 'completed' : null]
          .filter(Boolean).join(', ');
        return <span role="cell" key={p.id} data-position={p.id}
          className={`fb-cell${active ? ' active' : ''}${done ? ' done' : ''}${!available ? ' unavailable' : ''}${dimmed ? ' dimmed' : ''}`}
          aria-label={label}>
          <span className="fb-dot" aria-hidden="true">
            <strong>{visibleName ? spell(p.pitch) : '·'}</strong>
            {(active || done || !available) && <small className="fb-dot-mark">{done ? '✓' : active ? '➜' : '×'}</small>}
          </span>
        </span>;
      })}
    </div>
  );

  return <div className="fb-map">
    <div className="fb-chart" role="table" aria-label="First-position violin fingerboard chart" aria-describedby="fb-spacing-info">
      <div className="fb-chart-head" role="row"><span role="columnheader">Position</span>{STRINGS.map(s => <span role="columnheader" key={s}>{s} string</span>)}</div>
      {renderRow('open')}
      <div className="fb-neck" role="rowgroup">
        <div className="fb-strings" aria-hidden="true">{STRINGS.map(s => <span key={s} />)}</div>
        <div className="fb-nut" aria-hidden="true"><span>Nut</span></div>
        <div className="fb-stops" role="presentation">{ROWS.filter(row => row !== 'open').map(row => (
          <div key={row} role="presentation" className="fb-stop"
            style={{ '--fb-row-y': `${100 * distanceFromNut(position('D', row)) / stopSpan}%` } as CSSProperties}>
            {renderRow(row)}
          </div>
        ))}</div>
      </div>
    </div>
    <div className="fb-legend" aria-hidden="true">
      <span><b className="next">➜</b> Next note</span><span><b className="played">✓</b> Pitch matched</span><span><b>×</b> Out of range</span>
    </div>
    {shape && <p className="fb-shape"><strong>{shape === 'high2' ? 'High 2' : 'Low 2'}</strong>
      {shape === 'high2' ? ' · Fingers 2 and 3 close together.' : ' · Fingers 1 and 2 close together.'}</p>}
  </div>;
}
