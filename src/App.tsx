import { useEffect, useState } from 'react';
import { loadReference, saveReference } from './reference';
import { Practice, type PracticeSummary } from './Practice';
import { Tuner } from './Tuner';
import { PwaStatus } from './PwaStatus';

function completionText(summary: PracticeSummary | null) {
  if (!summary) return { title: 'Four open strings played.', body: 'Take a break or practice again.' };
  const focused = new Set(summary.notes).size === 1;
  const notes = focused ? `${summary.notes.length} whole notes on ${summary.notes[0]}` : summary.notes.map(n => n.replace(/\d/, '')).join(', ').replace(/, ([^,]*)$/, ', and $1');
  if (summary.mode === 'quick') return { title: focused ? `${summary.notes[0]} recognized ${summary.notes.length} times.` : 'Four open strings played.', body: `You matched ${notes} with a steady pitch. Take a break or practice again.` };
  return { title: focused ? `${summary.notes.length} whole notes held.` : 'Four whole notes held.', body: `You found and sustained ${notes} for four beats each at ♩ = ${summary.tempo}. Take a break or practice again.` };
}

export function App() {
  const [screen, setScreen] = useState<'select' | 'exercise' | 'complete' | 'tuner'>('select');
  const [a4, setA4] = useState(loadReference);
  useEffect(() => saveReference(a4), [a4]);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  // Remounting Practice gives each visit a fresh exercise and microphone session.
  const [visit, setVisit] = useState(0);
  const openExercise = () => { setVisit(v => v + 1); setScreen('exercise'); };
  const goHome = () => setScreen('select');
  const done = completionText(summary);
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-mark">𝄞</span><span>Violin Studio</span></div><span className="header-tag">Practice at your pace</span></header>
    <main>
      {screen === 'select' && <section className="welcome"><p className="eyebrow">A quiet place to practice</p><h1>Hear the note. Find your sound.</h1><p>Play a real violin and follow the notes on the staff. Start with the four open strings.</p><button className="exercise-card" onClick={openExercise}><span className="card-icon">𝄞</span><span><strong>Open Strings Practice</strong><small>G · D · A · E &nbsp;•&nbsp; Whole notes in 4/4</small></span><span aria-hidden="true">→</span></button><button className="exercise-card" onClick={() => setScreen('tuner')}><span className="card-icon">♮</span><span><strong>Instrument Tuner</strong><small>Violin strings or chromatic · No scoring</small></span><span aria-hidden="true">→</span></button></section>}
      {screen === 'tuner' && <Tuner onBack={goHome} a4={a4} onReferenceChange={setA4} />}
      {screen === 'exercise' && <Practice key={visit} a4={a4} initialFocus={summary?.focus ?? 'all'} onBack={goHome} onComplete={result => { setSummary(result); setScreen('complete'); }} />}
      {screen === 'complete' && <section className="completion"><p className="eyebrow">Practice complete</p><h1>{done.title}</h1><p>{done.body}</p><div className="completion-actions"><button className="primary" onClick={openExercise}>Practice again</button><button className="secondary" onClick={goHome}>Back to exercises</button></div></section>}
    </main><PwaStatus /><footer>Local practice · No account or upload</footer>
  </div>;
}
