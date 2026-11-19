import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Accidental, BarlineType, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { inspectWindow, scoreTrack, trackOffset, TRACK_BAR_INSET, TRACK_MEASURE_PX, TRACK_PLAYHEAD_X } from './layout';
import type { PracticeNote } from './music';
import { DURATION_NAMES, type KeySignature } from './notation';
import { ScoreHold, type ScoreHoldDisplay } from './ScoreHold';

export const STAFF_HEIGHT = 150;
const STAFF_Y = 24;
const KEY_WIDTH: Record<KeySignature, number> = { C: 0, G: 12, D: 22 };

export interface StaffProps {
  notes: PracticeNote[];
  currentIndex: number;
  keySignature?: KeySignature;
  tempo?: number;
  /** Text under each note (note name, ✓, …), or null to leave blank. */
  labels: (string | null)[];
  /** Suggested fingering under each note, when shown. */
  fingering?: (string | null)[] | null;
  /** Read-only score inspection before a pattern challenge starts. */
  allowPagePreview?: boolean;
  /** Guided practice only. This visual does not control the exercise timer. */
  hold?: ScoreHoldDisplay;
}

/** One continuous score with a fixed clef and a pitch-driven reading position. */
export function Staff({ notes, currentIndex, keySignature = 'C', tempo, labels, fingering, allowPagePreview = false, hold }: StaffProps) {
  const host = useRef<HTMLDivElement>(null);
  const clef = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [previewStart, setPreviewStart] = useState(0);
  const track = useMemo(() => scoreTrack(notes), [notes]);
  const clefWidth = 76 + KEY_WIDTH[keySignature];
  const focus = Math.min(currentIndex, notes.length - 1);
  const target = track.slots[focus];
  const inspection = inspectWindow(track.measures.length, viewportWidth, previewStart);
  const withPreview = allowPagePreview && viewportWidth > 0 && inspection.length < track.measures.length;
  const inspecting = withPreview && inspection.first > 0;
  const offset = inspecting ? inspection.first * TRACK_MEASURE_PX : trackOffset(target?.x);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setViewportWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!withPreview) setPreviewStart(0);
  }, [withPreview, notes]);

  useLayoutEffect(() => {
    const element = clef.current;
    if (!element) return;
    element.replaceChildren();
    const renderer = new Renderer(element, Renderer.Backends.SVG).resize(clefWidth, STAFF_HEIGHT);
    const header = new Stave(0, STAFF_Y, clefWidth).setBegBarType(BarlineType.NONE).setEndBarType(BarlineType.NONE);
    header.addClef('treble');
    if (keySignature !== 'C') header.addKeySignature(keySignature);
    header.addTimeSignature('4/4');
    header.setContext(renderer.getContext()).draw();
  }, [clefWidth, keySignature]);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element || !track.measures.length) return;
    element.replaceChildren();
    const renderer = new Renderer(element, Renderer.Backends.SVG).resize(track.width, STAFF_HEIGHT);
    const context = renderer.getContext();
    new Stave(0, STAFF_Y, TRACK_BAR_INSET).setBegBarType(BarlineType.NONE).setEndBarType(BarlineType.NONE).setContext(context).draw();
    track.measures.forEach((indices, measure) => {
      const stave = new Stave(TRACK_BAR_INSET + measure * TRACK_MEASURE_PX, STAFF_Y, TRACK_MEASURE_PX)
        .setBegBarType(BarlineType.NONE);
      if (measure === track.measures.length - 1) stave.setEndBarType(BarlineType.END);
      stave.setContext(context).draw();
      const staveNotes = indices.map(index => {
        const note = notes[index];
        const staveNote = new StaveNote({ clef: 'treble', keys: [note.vexKey], duration: note.duration ?? 'w' }).setStave(stave);
        if (note.accidental) staveNote.addModifier(new Accidental(note.accidental), 0);
        staveNote.setStyle({ fillStyle: 'currentColor', strokeStyle: 'currentColor' });
        return staveNote;
      });
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(staveNotes).setStave(stave);
      new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX());
      // Keep VexFlow's vertical engraving and modifier positioning, but use the practice time grid for X.
      staveNotes.forEach((note, i) => {
        const tick = note.getTickContext();
        const center = note.getNoteHeadBeginX() + note.getGlyphWidth() / 2;
        tick.setX(tick.getX() + track.slots[indices[i]].x - center);
      });
      voice.draw(context, stave);
    });
    element.querySelectorAll<SVGGElement>('.vf-stavenote').forEach((group, index) => {
      group.dataset.scoreNote = String(index);
      group.dataset.noteX = String(track.slots[index].x);
    });
    const svg = element.querySelector('svg');
    svg?.setAttribute('data-note-durations', notes.map(n => n.duration ?? 'w').join(' '));
    svg?.setAttribute('data-measures', `1-${track.measures.length}`);
  }, [notes, track]);

  useLayoutEffect(() => {
    host.current?.querySelectorAll<SVGGElement>('[data-score-note]').forEach((group, index) => {
      group.dataset.noteState = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'ahead';
    });
  }, [currentIndex, notes, track]);

  const activeHold = !inspecting && currentIndex < notes.length ? hold : undefined;
  const last = track.measures.length;
  const accessibleIndices = inspecting ? track.measures.slice(inspection.first, inspection.last + 1).flat() : notes.map((_, index) => index);
  const measureText = withPreview
    ? `Measures ${inspection.first + 1}–${inspection.last + 1} of ${last}`
    : `Measure ${(target?.measure ?? 0) + 1} of ${last}`;
  const label = `Treble clef staff, ${keySignature === 'C' ? 'no key signature' : `key of ${keySignature} major`}, 4/4, measures ${inspecting ? inspection.first + 1 : 1} to ${inspecting ? inspection.last + 1 : last} of ${last}: ${accessibleIndices.map(i => `${notes[i].name} ${DURATION_NAMES[notes[i].duration ?? 'w']}${i === currentIndex ? ' current' : i < currentIndex ? ' complete' : ''}`).join(', ')}`;
  return <div className="staff-wrap">
    {last > 1 && <p className="staff-page">{measureText}</p>}
    {withPreview && <div className="staff-preview-controls" aria-label="Inspect score pages">
      <button type="button" className="secondary" onClick={() => setPreviewStart(Math.max(0, inspection.first - inspection.length))} disabled={inspection.first === 0}>Previous score page</button>
      <button type="button" className="secondary" onClick={() => setPreviewStart(inspection.last + 1)} disabled={inspection.last === last - 1}>Next score page</button>
    </div>}
    <div className="staff-scroller" style={{ gridTemplateColumns: `${clefWidth}px minmax(0, 1fr)` }}>
      <div className="staff-clef" aria-hidden="true">
        <div ref={clef} />
        {tempo && <span className="staff-tempo-mark">♩ = {tempo}</span>}
      </div>
      <div className="staff-track-window" ref={viewport} data-overflow={track.width - offset > viewportWidth}>
        {!inspecting && <div className="staff-playhead" style={{ left: TRACK_PLAYHEAD_X }} aria-hidden="true" />}
        <div className="staff-track" style={{ width: track.width, transform: `translateX(${-offset}px)` }} data-offset={offset}>
          <div className={`staff-stage${hold ? ' has-hold' : ''}`}>
            <div className="staff" ref={host} role="img" aria-label={label} />
            {activeHold && target && <ScoreHold hold={activeHold} start={target.x} end={target.holdEnd} width={track.width} />}
          </div>
          <div className="note-hints">{notes.map((note, index) => <span key={note.id} className={index === currentIndex ? 'active' : index < currentIndex ? 'done' : ''} style={{ left: track.slots[index].x }}>{labels[index] ?? ''}</span>)}</div>
          {fingering && <div className="note-hints fingering" aria-label="Suggested string and finger">{notes.map((note, index) => <span key={note.id} className={index === currentIndex ? 'active' : ''} style={{ left: track.slots[index].x }}>{fingering[index] ?? ''}</span>)}</div>}
        </div>
      </div>
    </div>
    {activeHold && <div className="score-hold-meta" role="progressbar" aria-label="Note hold" aria-valuenow={Math.round(activeHold.progress * 100)}
      aria-valuetext={activeHold.holding ? `Beat ${activeHold.beat} of ${activeHold.beats}` : 'Hold starts once the note is steady'}>
      <span>{activeHold.durationLabel}</span>
      <span>{activeHold.cents === null ? 'Pitch trace starts when steady' : `${activeHold.cents > 0 ? '+' : ''}${Math.round(activeHold.cents)} cents${activeHold.holding ? ` · Beat ${activeHold.beat}/${activeHold.beats}` : ''}`}</span>
    </div>}
  </div>;
}
