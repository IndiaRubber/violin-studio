import { useEffect, useRef, useState } from 'react';
import { Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import type { PracticeNote } from './music';

export function Staff({ notes, currentIndex, showHints }: { notes: PracticeNote[]; currentIndex: number; showHints: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [positions, setPositions] = useState<number[]>([]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = host.current;
    if (!element || width < 100) return;
    element.replaceChildren();
    const renderWidth = Math.max(320, Math.floor(width));
    const renderer = new Renderer(element, Renderer.Backends.SVG);
    renderer.resize(renderWidth, 220);
    const context = renderer.getContext();
    const stave = new Stave(22, 64, renderWidth - 44).addClef('treble');
    stave.setContext(context).draw();
    const staveNotes = notes.map((note, index) => {
      const staveNote = new StaveNote({ clef: 'treble', keys: [note.vexKey], duration: 'q' });
      const color = index < currentIndex ? '#28775d' : index === currentIndex ? '#a34b29' : '#617080';
      staveNote.setStyle({ fillStyle: color, strokeStyle: color });
      return staveNote;
    });
    const voice = new Voice({ numBeats: notes.length, beatValue: 4 }).addTickables(staveNotes);
    new Formatter().joinVoices([voice]).format([voice], Math.max(140, renderWidth - 125));
    voice.draw(context, stave);
    setPositions(staveNotes.map(note => note.getAbsoluteX()));
  }, [notes, currentIndex, width]);
  return <div className="staff-wrap"><div className="staff" ref={host} role="img" aria-label={`Treble clef staff: ${notes.map((n, i) => `${n.name}${i === currentIndex ? ' current' : i < currentIndex ? ' complete' : ''}`).join(', ')}`} /><div className="note-hints">{notes.map((note, index) => <span key={note.id} className={index === currentIndex ? 'active' : ''} style={{ left: positions[index] ?? 0 }}>{showHints ? note.name : index < currentIndex ? '✓' : index === currentIndex ? 'Current' : '·'}</span>)}</div></div>;
}
