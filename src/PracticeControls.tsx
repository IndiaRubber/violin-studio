/** Shared microphone and restart controls for the trainer and all scored exercises. */
export function PracticeControls({ listening, starting, complete = false, scope, onToggleListening, onRestartNote, onRestart, onShuffle }: {
  listening: boolean; starting: boolean; complete?: boolean; scope: 'exercise' | 'sequence';
  onToggleListening: () => void; onRestartNote: () => void; onRestart: () => void; onShuffle?: () => void;
}) {
  const listenLabel = starting ? 'Cancel microphone connection' : listening ? 'Stop Listening' : 'Start Listening';
  const restartLabel = scope === 'exercise' ? 'Restart exercise' : 'Restart sequence';
  return <div className="practice-action-bar" role="group" aria-label={scope === 'sequence' ? 'Fingerboard practice controls' : 'Exercise practice controls'}>
    <button type="button" className="primary" aria-label={listenLabel} title={listenLabel} onClick={onToggleListening} disabled={complete}>
      <PracticeIcon name={listening || starting ? 'stop' : 'microphone'} />
    </button>
    <button type="button" className="secondary" aria-label="Restart note" title="Restart note" disabled={complete} onClick={onRestartNote}>
      <PracticeIcon name="note" />
    </button>
    <button type="button" className="secondary" aria-label={restartLabel} title={restartLabel} onClick={onRestart}>
      <PracticeIcon name="sequence" />
    </button>
    {onShuffle && <button type="button" className="secondary" aria-label="New shuffle" title="New shuffle" onClick={onShuffle}>
      <PracticeIcon name="shuffle" />
    </button>}
  </div>;
}

function PracticeIcon({ name }: { name: 'microphone' | 'stop' | 'note' | 'sequence' | 'shuffle' }) {
  return <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'microphone' && <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v3.5m-3 0h6" /></>}
    {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />}
    {name === 'note' && <><path d="M3 10a9 9 0 1 1 .8 7M3 5.5V10h4.5M13.5 14.5V7.75l3 1" /><ellipse cx="11.5" cy="14.5" rx="2" ry="1.5" /></>}
    {name === 'sequence' && <><path d="M5 5v14" /><path d="m18 5-10 7 10 7z" /></>}
    {name === 'shuffle' && <path d="M3 6h3c4 0 5 12 11 12h4m-3-3 3 3-3 3M3 18h3c1.5 0 2.5-1.5 3.5-3.5m4-5C14.5 7.5 15.5 6 17 6h4m-3-3 3 3-3 3" />}
  </svg>;
}
