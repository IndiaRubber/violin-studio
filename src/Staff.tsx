import { useEffect, useMemo, useRef, useState } from 'react';
import { Accidental, BarlineType, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { minMeasureWidth, pageOf, paginate } from './layout';
import type { PracticeNote } from './music';
import { DURATION_NAMES, type KeySignature } from './notation';

export const STAFF_HEIGHT = 150;
const LEFT = 6;
const KEY_WIDTH: Record<KeySignature, number> = { C: 0, G: 12, D: 22 };
/** Clef + key signature (+ 4/4 on the first page) at the start of each page. */
const headerWidth = (key: KeySignature) => (page: number) => 50 + KEY_WIDTH[key] + (page === 0 ? 26 : 0);
const COLORS = { done: '#28775d', current: '#a34b29', ahead: '#617080' };

export interface StaffProps {
  notes: PracticeNote[];
  currentIndex: number;
  keySignature?: KeySignature;
  tempo?: number;
  /** Text under each note (note name, ✓, …), or null to leave blank. */
  labels: (string | null)[];
  /** Suggested fingering under each note, when shown. */
  fingering?: (string | null)[] | null;
}

/**
 * Renders exercise notes on a treble staff with VexFlow: one strict 4/4 voice per measure
 * (VexFlow rejects a measure whose durations do not total four beats), key signature,
 * printed accidentals, barlines, and ledger lines. Long exercises are shown a page of
 * measures at a time; the page turns when the current note moves past it.
 */
export function Staff({ notes, currentIndex, keySignature = 'C', tempo, labels, fingering }: StaffProps) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [positions, setPositions] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  /** Note indices grouped by measure. */
  const measures = useMemo(() => {
    const grouped: number[][] = [];
    notes.forEach((note, index) => { (grouped[note.measure ?? index] ??= []).push(index); });
    return grouped.filter(Boolean);
  }, [notes]);
  const renderWidth = Math.max(320, Math.floor(width));
  const pages = useMemo(() => paginate(measures.map(m => m.length), renderWidth - LEFT * 2, headerWidth(keySignature)), [measures, renderWidth, keySignature]);
  const focusIndex = Math.min(currentIndex, notes.length - 1);
  const pageIndex = pageOf(pages, Math.max(0, measures.findIndex(m => m.includes(focusIndex))));
  const page = pages[pageIndex];

  useEffect(() => {
    const element = host.current;
    if (!element || width < 100 || !page) return;
    element.replaceChildren();
    const renderer = new Renderer(element, Renderer.Backends.SVG);
    renderer.resize(renderWidth, STAFF_HEIGHT);
    const context = renderer.getContext();
    const visible = measures.slice(page.first, page.last + 1);
    const header = headerWidth(keySignature)(pageIndex);
    const minTotal = visible.reduce((sum, m) => sum + minMeasureWidth(m.length), 0);
    // Share spare width between measures, but never stretch a measure absurdly wide.
    const stretch = Math.min(Math.max(0, renderWidth - LEFT * 2 - header - minTotal) / visible.length, 140);
    const centers = new Map<number, number>();
    const rendered: string[] = [];
    let x = LEFT;
    visible.forEach((indices, offset) => {
      const measureNumber = page.first + offset;
      const first = offset === 0;
      const stave = new Stave(x, 24, minMeasureWidth(indices.length) + stretch + (first ? header : 0));
      if (first) {
        stave.addClef('treble');
        if (keySignature !== 'C') stave.addKeySignature(keySignature);
        if (pageIndex === 0) stave.addTimeSignature('4/4');
        if (pageIndex === 0 && tempo) stave.setTempo({ duration: 'q', bpm: tempo }, 0);
        if (measureNumber > 0) stave.setMeasure(measureNumber + 1);
      }
      if (measureNumber === measures.length - 1) stave.setEndBarType(BarlineType.END);
      stave.setContext(context).draw();
      const staveNotes = indices.map(index => {
        const note = notes[index];
        const staveNote = new StaveNote({ clef: 'treble', keys: [note.vexKey], duration: note.duration ?? 'w' });
        if (note.accidental) staveNote.addModifier(new Accidental(note.accidental), 0);
        const color = index < currentIndex ? COLORS.done : index === currentIndex ? COLORS.current : COLORS.ahead;
        staveNote.setStyle({ fillStyle: color, strokeStyle: color });
        return staveNote;
      });
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(staveNotes).setStave(stave);
      const span = stave.getNoteEndX() - stave.getNoteStartX();
      new Formatter().joinVoices([voice]).format([voice], span);
      if (staveNotes.length === 1) {
        // A lone whole note is centred in its measure, as engraved whole-measure notes usually are.
        const head = staveNotes[0].getGlyphWidth();
        staveNotes[0].setXShift(Math.max(0, (span - head) / 2 - staveNotes[0].getTickContext().getX()));
      }
      voice.draw(context, stave);
      staveNotes.forEach((staveNote, i) => {
        centers.set(indices[i], staveNote.getNoteHeadBeginX() + staveNote.getGlyphWidth() / 2);
        rendered.push(staveNote.getDuration());
      });
      x += stave.getWidth();
    });
    const svg = element.querySelector('svg');
    // Exposed for tests: what VexFlow actually rendered on this page.
    svg?.setAttribute('data-note-durations', rendered.join(' '));
    svg?.setAttribute('data-measures', `${page.first + 1}-${page.last + 1}`);
    setPositions(centers);
  }, [notes, measures, currentIndex, renderWidth, width, tempo, keySignature, page, pageIndex]);

  const visibleIndices = page ? measures.slice(page.first, page.last + 1).flat() : [];
  const label = `Treble clef staff, ${keySignature === 'C' ? 'no key signature' : `key of ${keySignature} major`}, 4/4${page ? `, measures ${page.first + 1} to ${page.last + 1} of ${measures.length}` : ''}: ${visibleIndices.map(i => `${notes[i].name} ${DURATION_NAMES[notes[i].duration ?? 'w']}${i === currentIndex ? ' current' : i < currentIndex ? ' complete' : ''}`).join(', ')}`;
  return <div className="staff-wrap">
    {pages.length > 1 && page && <p className="staff-page">Measures {page.first + 1}–{page.last + 1} of {measures.length}</p>}
    <div className="staff" ref={host} role="img" aria-label={label} />
    <div className="note-hints">{visibleIndices.map(index => <span key={notes[index].id} className={index === currentIndex ? 'active' : index < currentIndex ? 'done' : ''} style={{ left: positions.get(index) ?? 0 }}>{labels[index] ?? ''}</span>)}</div>
    {fingering && <div className="note-hints fingering" aria-label="Suggested string and finger">{visibleIndices.map(index => <span key={notes[index].id} className={index === currentIndex ? 'active' : ''} style={{ left: positions.get(index) ?? 0 }}>{fingering[index] ?? ''}</span>)}</div>}
  </div>;
}
