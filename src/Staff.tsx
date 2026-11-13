import { useEffect, useRef, useState } from 'react';
import { BarlineType, Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import type { PracticeNote } from './music';

export const STAFF_HEIGHT = 150;
const FIRST_MEASURE_EXTRA = 78; // clef + 4/4 time signature

/**
 * Renders each written note as a whole note filling one 4/4 measure on a treble staff.
 * Voices are strict, so VexFlow rejects a measure whose durations do not total 4 beats.
 */
export function Staff({ notes, currentIndex, showHints, tempo }: { notes: PracticeNote[]; currentIndex: number; showHints: boolean; tempo?: number }) {
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
    renderer.resize(renderWidth, STAFF_HEIGHT);
    const context = renderer.getContext();
    const left = 8;
    const measureWidth = Math.min(240, (renderWidth - left * 2 - FIRST_MEASURE_EXTRA) / notes.length);
    let x = left;
    const centers: number[] = [];
    const durations: string[] = [];
    notes.forEach((note, index) => {
      const first = index === 0;
      const stave = new Stave(x, 24, measureWidth + (first ? FIRST_MEASURE_EXTRA : 0));
      if (first) {
        stave.addClef('treble').addTimeSignature('4/4');
        if (tempo) stave.setTempo({ duration: 'q', bpm: tempo }, 0);
      }
      if (index === notes.length - 1) stave.setEndBarType(BarlineType.END);
      stave.setContext(context).draw();
      const staveNote = new StaveNote({ clef: 'treble', keys: [note.vexKey], duration: 'w' });
      const color = index < currentIndex ? '#28775d' : index === currentIndex ? '#a34b29' : '#617080';
      staveNote.setStyle({ fillStyle: color, strokeStyle: color });
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([staveNote]).setStave(stave);
      const span = stave.getNoteEndX() - stave.getNoteStartX();
      new Formatter().joinVoices([voice]).format([voice], span);
      // Centre the whole note in the measure body, as engraved whole-measure notes usually are.
      const head = staveNote.getGlyphWidth();
      // Positions are relative to the measure's note area until draw.
      staveNote.setXShift(Math.max(0, (span - head) / 2 - staveNote.getTickContext().getX()));
      voice.draw(context, stave);
      centers.push(staveNote.getNoteHeadBeginX() + head / 2);
      durations.push(staveNote.getDuration());
      x += stave.getWidth();
    });
    // Exposed for tests: the durations VexFlow actually rendered.
    element.querySelector('svg')?.setAttribute('data-note-durations', durations.join(' '));
    setPositions(centers);
  }, [notes, currentIndex, width, tempo]);
  const label = `Treble clef staff in 4/4: ${notes.map((n, i) => `${n.name} whole note${i === currentIndex ? ' current' : i < currentIndex ? ' complete' : ''}`).join(', ')}`;
  return <div className="staff-wrap"><div className="staff" ref={host} role="img" aria-label={label} /><div className="note-hints">{notes.map((note, index) => <span key={note.id} className={index === currentIndex ? 'active' : ''} style={{ left: positions[index] ?? 0 }}>{showHints ? note.name : index < currentIndex ? '✓' : index === currentIndex ? 'Now' : '·'}</span>)}</div></div>;
}
