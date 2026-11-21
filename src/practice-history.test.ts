import { describe, expect, it } from 'vitest';
import { groupByDay, lessonEvent, localDay, warmupEvent } from './practice-history';

describe('local practice history', () => {
  it('keeps stable distinct IDs and records timestamps without invented durations', () => {
    const first = warmupEvent('bowing', 'Right-hand bowing', '2026-11-20T17:30:00.000Z', 'warmup-1');
    const second = warmupEvent('bowing', 'Right-hand bowing', '2026-11-20T18:30:00.000Z', 'warmup-2');
    expect(first.id).not.toBe(second.id);
    expect(first.durationMs).toBeUndefined();
    const summary = { exerciseId: 'd-string-walk', title: 'D-String Walk', mode: 'quick' as const, tempo: 60, notes: ['D4'], focus: null, retriedNotes: 0, extraAttempts: 0 };
    const lesson = lessonEvent(summary, '2026-11-20T19:00:00.000Z', 'lesson-1');
    expect(lesson).toMatchObject({ id: 'lesson-1', type: 'lesson', exerciseId: 'd-string-walk', summary });
    expect(lesson.durationMs).toBeUndefined();
  });
  it('groups by local calendar day, newest first, including a local midnight rollover', () => {
    const late = new Date(2026, 10, 20, 23, 55).toISOString();
    const early = new Date(2026, 10, 21, 0, 5).toISOString();
    const groups = groupByDay([warmupEvent('bowing', 'Bowing', late, 'old'), warmupEvent('placement', 'Placement', early, 'new')]);
    expect(localDay(late)).toBe('2026-11-20');
    expect(localDay(early)).toBe('2026-11-21');
    expect(groups.map(([day]) => day)).toEqual(['2026-11-21', '2026-11-20']);
  });
});
