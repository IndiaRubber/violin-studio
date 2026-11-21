import { useEffect, useState } from 'react';
import { addPracticeEvent, deletePracticeEvent, groupByDay, listPracticeEvents, localDay, warmupEvent, WARMUPS, type PracticeEvent } from './practice-history';

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dateLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export function DailyPractice({ onBack, onRecord, onOpenLesson }: { onBack: () => void; onRecord?: () => void; onOpenLesson?: () => void }) {
  const [events, setEvents] = useState<PracticeEvent[]>([]);
  const [today, setToday] = useState(() => localDay(new Date().toISOString()));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void listPracticeEvents().then(items => { if (active) { setEvents(items); setLoaded(true); } }).catch(() => { if (active) { setError('Practice history could not be opened. Your checks will not be marked until storage works.'); setLoaded(true); } });
    const interval = window.setInterval(() => setToday(localDay(new Date().toISOString())), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const toggleWarmup = async (activity: typeof WARMUPS[number]) => {
    if (busy) return;
    const existing = events.find(event => event.type === 'warmup' && event.activityId === activity.id && localDay(event.completedAt) === today);
    setBusy(activity.id); setError('');
    try {
      if (existing) { await deletePracticeEvent(existing.id); setEvents(previous => previous.filter(item => item.id !== existing.id)); }
      else { const event = warmupEvent(activity.id, activity.title); await addPracticeEvent(event); setEvents(previous => [event, ...previous]); }
    } catch { setError('Could not save that change locally. Check browser storage and try again.'); }
    finally { setBusy(null); }
  };
  const groups = groupByDay(events);
  return <section className="daily-practice">
    <div className="practice-heading"><button className="text-button" onClick={onBack}>← Home</button><span>Daily Practice</span></div>
    <h1>Today’s Practice</h1>
    <p className="objective">A gentle checklist and a record of what you completed. Suggested minutes are optional; a check records the time, not the minutes.</p>
    <div className="warmup-list">{WARMUPS.map(activity => {
      const checked = events.some(event => event.type === 'warmup' && event.activityId === activity.id && localDay(event.completedAt) === today);
      return <label className="warmup-card" key={activity.id}><input type="checkbox" checked={checked} disabled={!loaded || busy !== null} onChange={() => void toggleWarmup(activity)} />
        <span><strong>{activity.title}</strong><small>{activity.description}</small><small>Suggested: about {activity.minutes} minutes · optional</small></span></label>;
    })}</div>
    <div className="daily-actions">{onRecord && <button className="primary" onClick={onRecord}>Record Performance</button>}{onOpenLesson && <button className="secondary" onClick={onOpenLesson}>Choose a lesson</button>}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <h2>Practice history</h2>
    {!loaded ? <p>Loading local history…</p> : groups.length === 0 ? <p>No entries yet. Begin whenever you like.</p> : groups.map(([day, items]) =>
      <section className="history-day" key={day}><h3>{day === today ? 'Today' : dateLabel(day)}</h3><ul>{items.map(item => <li key={item.id}><time dateTime={item.completedAt}>{timeLabel(item.completedAt)}</time><span>{item.title}<small>{item.type === 'lesson' ? 'Lesson completed' : item.type === 'recording' ? 'Recording saved' : 'Warmup completed'}{item.durationMs !== undefined ? ` · ${Math.round(item.durationMs / 1000)} seconds` : ''}</small></span></li>)}</ul></section>)}
  </section>;
}
