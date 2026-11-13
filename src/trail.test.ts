import { describe, expect, it } from 'vitest';
import { ageOpacity, ageToY, centsToX, LIVE_MS, PitchTrail, TRAIL_WINDOW_MS } from './trail';
import { nearestString, tuningDirection, tunerReadout, VIOLIN_STRINGS } from './tuner-logic';

const W = 300, H = 240;
const at = (hz: number, cents: number) => hz * 2 ** (cents / 1200);
const A4 = 440, D4 = VIOLIN_STRINGS[1].frequency;

describe('trail geometry', () => {
  it('places flat left, in tune at the centre line, sharp right, clamped at the edges', () => {
    expect(centsToX(0, W)).toBe(150);
    expect(centsToX(-25, W)).toBe(75);
    expect(centsToX(25, W)).toBe(225);
    expect(centsToX(-80, W)).toBe(0);
    expect(centsToX(400, W)).toBe(300);
  });
  it('puts the newest reading at the top and older ones lower, fading with age', () => {
    expect(ageToY(0, H)).toBe(0);
    expect(ageToY(1500, H)).toBe(120);
    expect(ageToY(9000, H)).toBe(H);
    expect(ageOpacity(0)).toBe(1);
    expect(ageOpacity(1500)).toBe(0.5);
    expect(ageOpacity(TRAIL_WINDOW_MS)).toBe(0);
  });
  it('moves points down by elapsed time, not by reading count', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:a4');
    trail.push(1000, 10);
    expect(trail.geometry(1000, W, H)[0][0].y).toBe(0);
    expect(trail.geometry(1750, W, H)[0][0].y).toBe(60); // 750 ms later, no new readings
    expect(trail.geometry(2500, W, H)[0][0].y).toBe(120);
  });
});

describe('pitch trail history', () => {
  it('records a correction from sharp toward the centre, newest on top', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:a4');
    const cents = [30, 24, 18, 12, 7, 3, 1, 0];
    cents.forEach((c, i) => trail.push(i * 50, c));
    const [segment] = trail.geometry(350, W, H);
    expect(segment).toHaveLength(8);
    expect(segment.map(p => p.x)).toEqual([...segment.map(p => p.x)].sort((a, b) => b - a)); // older points further right (sharper)
    expect(segment.at(-1)).toMatchObject({ x: 150, y: 0 });
    expect(trail.live(350)?.cents).toBe(0);
  });

  it('silence clears the live marker immediately but keeps fading history', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:a4');
    for (let t = 0; t <= 500; t += 50) trail.push(t, 2);
    trail.push(550, null);
    expect(trail.live(550)).toBeNull();
    expect(trail.pointCount()).toBe(11);
    const faded = trail.geometry(2000, W, H)[0];
    expect(faded[0].opacity).toBeLessThan(0.4);
    expect(trail.geometry(3600, W, H)).toEqual([]); // fully expired after the window
  });

  it('never connects across a gap', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:d4');
    trail.push(0, -20); trail.push(50, -18);
    trail.push(100, null); // uncertain frame
    trail.push(150, -5); trail.push(200, -4);
    trail.push(800, 0); // readings stopped arriving for 600 ms
    expect(trail.geometry(800, W, H).map(s => s.length)).toEqual([2, 2, 1]);
  });

  it('a stale reading is not shown as live', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:a4');
    trail.push(1000, 4);
    expect(trail.live(1000 + LIVE_MS)).not.toBeNull();
    expect(trail.live(1001 + LIVE_MS)).toBeNull();
  });

  it('a target change starts an empty trail', () => {
    const trail = new PitchTrail();
    trail.setTarget('string:a4');
    for (let t = 0; t < 500; t += 50) trail.push(t, 3);
    trail.setTarget('string:a4'); // same target: keeps history
    expect(trail.pointCount()).toBe(10);
    trail.setTarget('string:d4');
    expect(trail.pointCount()).toBe(0);
    expect(trail.live(500)).toBeNull();
    trail.push(550, -12);
    expect(trail.geometry(550, W, H)).toHaveLength(1);
  });

  it('ignores readings when there is no target', () => {
    const trail = new PitchTrail();
    trail.push(0, 5);
    expect(trail.pointCount()).toBe(0);
  });
});

describe('tuning direction and readouts', () => {
  it('says In tune anywhere inside the existing ±10 cent band', () => {
    expect(tuningDirection(0)).toBe('In tune');
    expect(tuningDirection(-7)).toBe('In tune');
    expect(tuningDirection(10)).toBe('In tune');
    expect(tuningDirection(10.4)).toBe('Tune down');
    expect(tuningDirection(-11)).toBe('Tune up');
  });

  it('Manual: a wrong note is reported as Target D · Hearing A4, never as a sharp D', () => {
    const r = tunerReadout(A4, { mode: 'violin', auto: false, selectedId: 'd4', a4: 440 });
    expect(r).toMatchObject({ peg: 'd4', hearing: 'A4', cents: null, direction: null, mismatch: 'Target D · Hearing A4', targetKey: 'string:d4' });
    const octave = tunerReadout(D4 * 2, { mode: 'violin', auto: false, selectedId: 'd4', a4: 440 });
    expect(octave.mismatch).toBe('Target D · Hearing D5 (octave)');
    expect(octave.cents).toBeNull();
  });

  it('Manual: the selected string reports cents and direction', () => {
    const r = tunerReadout(at(D4, 18), { mode: 'violin', auto: false, selectedId: 'd4', a4: 440 });
    expect(r.cents).toBeCloseTo(18, 5);
    expect(r).toMatchObject({ direction: 'Tune down', mismatch: null, peg: 'd4' });
    expect(tunerReadout(null, { mode: 'violin', auto: false, selectedId: 'd4', a4: 440 })).toMatchObject({ peg: 'd4', cents: null, hearing: null });
  });

  it('Auto: highlights the open string the tuner identifies and keeps it through silence', () => {
    const r = tunerReadout(at(A4, -15), { mode: 'violin', auto: true, selectedId: 'g3', a4: 440 });
    expect(r).toMatchObject({ peg: 'a4', targetKey: 'string:a4', direction: 'Tune up' });
    expect(nearestString(at(A4, -15))?.note.id).toBe('a4');
    expect(tunerReadout(null, { mode: 'violin', auto: true, selectedId: 'g3', a4: 440, previousAuto: 'a4' }).peg).toBe('a4');
    const far = tunerReadout(1200, { mode: 'violin', auto: true, selectedId: 'g3', a4: 440, previousAuto: 'e5' });
    expect(far).toMatchObject({ cents: null, peg: 'e5' });
    expect(far.mismatch).toMatch(/not near an open string/);
  });

  it('Chromatic: follows the nearest note and implies no peg', () => {
    const r = tunerReadout(at(523.25, 22), { mode: 'chromatic', auto: true, selectedId: 'a4', a4: 440 });
    expect(r).toMatchObject({ peg: null, hearing: 'C5', direction: 'Tune down' });
    expect(r.targetKey).toBe('note:72');
  });

  it('respects the A4 reference', () => {
    expect(tunerReadout(442, { mode: 'violin', auto: false, selectedId: 'a4', a4: 442 }).cents).toBeCloseTo(0, 6);
    expect(tunerReadout(440, { mode: 'violin', auto: false, selectedId: 'a4', a4: 442 }).cents).toBeCloseTo(-7.85, 1);
  });
});
