import { expect, test, type Page } from '@playwright/test';

// Deterministic synthetic microphone: an oscillator the test retunes. Not violin audio.
async function syntheticMic(page: Page, hz: number, level = 1) {
  await page.addInitScript(([initialHz, initialLevel]) => {
    Object.assign(window, { micStops: 0 });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = initialHz; gain.gain.value = initialLevel;
      oscillator.connect(gain).connect(destination); oscillator.start(); await context.resume();
      for (const track of destination.stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { (window as unknown as { micStops: number }).micStops++; stop(); };
      }
      Object.assign(window, { mic: { set: (f: number, g: number) => { oscillator.frequency.value = f; gain.gain.value = g; } } });
      return destination.stream;
    } } });
  }, [hz, level]);
}
const setMic = (page: Page, hz: number, level = 1) => page.evaluate(([f, g]) => (window as unknown as { mic: { set: (f: number, g: number) => void } }).mic.set(f, g), [hz, level]);
const cents = (hz: number, c: number) => hz * 2 ** (c / 1200);
const graph = (page: Page) => page.locator('.tuner-graph');
const data = (page: Page) => graph(page).evaluate(el => ({ live: el.dataset.live, points: Number(el.dataset.points), segments: Number(el.dataset.segments), liveCents: el.dataset.liveCents ? Number(el.dataset.liveCents) : null }));
const D4 = 293.66, A4 = 440;

async function openTuner(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(graph(page)).toBeVisible();
}

test('trail follows a correction toward the centre, then the live marker clears and history fades', async ({ page }) => {
  await syntheticMic(page, cents(A4, 30));
  await openTuner(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect.poll(async () => (await data(page)).liveCents ?? 999, { timeout: 5000 }).toBeLessThan(40);
  const seen: number[] = [];
  for (const c of [30, 22, 15, 9, 4, 1]) {
    await setMic(page, cents(A4, c));
    await page.waitForTimeout(300);
    // Poll: under heavy CI load a reading can arrive late and is then (correctly) shown as stale.
    await expect.poll(async () => (await data(page)).live, { timeout: 2000 }).toBe('true');
    seen.push((await data(page)).liveCents!);
  }
  expect(seen[0]).toBeGreaterThan(20);
  expect(seen.at(-1)!).toBeLessThan(6);
  await expect(page.locator('.tuner-status')).toHaveText('In tune');
  await expect(page.locator('.tuner-cents')).toHaveText(/^\+?[0-5] cents$/);
  await expect(page.locator('.trail-marker')).toHaveClass(/is-live/);
  // Older, sharper readings are drawn to the right of centre on the canvas.
  const sharpPixels = await page.locator('.tuner-graph canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const right = context.getImageData(Math.round(width * 0.6), 0, Math.round(width * 0.35), height).data;
    let lit = 0; for (let i = 3; i < right.length; i += 4) if (right[i] > 0) lit++;
    return lit;
  });
  expect(sharpPixels).toBeGreaterThan(20);
  await page.screenshot({ path: 'test-results/tuner-trail-live.png' });
  // Silence: no live marker, no direction, but the history remains and fades.
  await setMic(page, A4, 0);
  await expect.poll(async () => (await data(page)).live, { timeout: 2000 }).toBe('false');
  await expect(page.locator('.trail-marker')).not.toHaveClass(/is-live/);
  await expect(page.locator('.tuner-status')).toHaveText('Play a string');
  await expect(page.locator('.tuner-cents')).toHaveText('—');
  expect((await data(page)).points).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/tuner-trail-fading.png' });
  await expect.poll(async () => (await data(page)).points, { timeout: 5000 }).toBe(0);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('a gap in input starts a new trail segment instead of joining across it', async ({ page }) => {
  await syntheticMic(page, cents(A4, -20));
  await openTuner(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect.poll(async () => (await data(page)).live, { timeout: 5000 }).toBe('true');
  await page.waitForTimeout(400);
  await setMic(page, A4, 0);
  await expect.poll(async () => (await data(page)).live).toBe('false');
  await page.waitForTimeout(300);
  await setMic(page, cents(A4, -5));
  await expect.poll(async () => (await data(page)).live, { timeout: 3000 }).toBe('true');
  await expect.poll(async () => (await data(page)).segments).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('Manual: a wrong note shows Target D · Hearing A4 and is not plotted as D', async ({ page }) => {
  await syntheticMic(page, D4);
  await openTuner(page);
  await page.getByRole('button', { name: /^D string/ }).click();
  await expect(page.getByRole('button', { name: /^D string/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-status')).toHaveText('In tune', { timeout: 5000 });
  await setMic(page, A4);
  await expect(page.locator('.tuner-status')).toHaveText('Target D · Hearing A4', { timeout: 5000 });
  await expect(page.locator('.tuner-note')).toHaveText('A4');
  await expect(page.locator('.tuner-cents')).toHaveText('—');
  await expect(page.locator('.tuner-status')).toHaveClass(/is-mismatch/);
  await expect.poll(async () => (await data(page)).live).toBe('false');
  await expect(page.getByRole('button', { name: /^D string/ })).toHaveAttribute('aria-pressed', 'true'); // selection unchanged
  await page.screenshot({ path: 'test-results/tuner-wrong-note.png' });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('changing the target string clears the trail', async ({ page }) => {
  await syntheticMic(page, A4);
  await openTuner(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect.poll(async () => (await data(page)).points, { timeout: 5000 }).toBeGreaterThan(5);
  await setMic(page, A4, 0);
  await page.getByRole('button', { name: /^E string/ }).click();
  expect((await data(page)).points).toBe(0);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('Auto highlights the identified open string; tapping a peg returns to Manual', async ({ page }) => {
  await syntheticMic(page, cents(D4, 12));
  await openTuner(page);
  const autoSwitch = page.getByRole('switch', { name: 'Auto' });
  await expect(autoSwitch).toHaveAttribute('aria-checked', 'false');
  await autoSwitch.click();
  await expect(autoSwitch).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: /^D string/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  await expect(page.locator('.tuner-status')).toHaveText('Tune down');
  await setMic(page, cents(A4, -15));
  await expect(page.getByRole('button', { name: /^A string/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  await expect(page.locator('.tuner-status')).toHaveText('Tune up');
  await expect(page.getByRole('button', { name: /^D string/ })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /^G string/ }).click();
  await expect(autoSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.tuner-status')).toHaveText('Target G · Hearing A4', { timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('Chromatic keeps the trail and readouts without selecting a peg', async ({ page }) => {
  await syntheticMic(page, cents(523.25, 20));
  await openTuner(page);
  await page.getByRole('button', { name: 'Chromatic' }).click();
  await expect(page.getByRole('switch', { name: 'Auto' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('C5', { timeout: 5000 });
  await expect(page.locator('.tuner-status')).toHaveText('Tune down');
  await expect(page.locator('.tuner-target')).toHaveText('Chromatic · nearest note');
  await expect.poll(async () => (await data(page)).live).toBe('true');
  for (const peg of await page.locator('.peg-button').all()) await expect(peg).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('keyboard: mode, Auto switch, and pegs are operable without a pointer', async ({ page }) => {
  await openTuner(page);
  await page.getByRole('button', { name: 'Violin' }).focus();
  await page.keyboard.press('Tab'); // Chromatic
  await page.keyboard.press('Tab'); // Auto switch
  await expect(page.getByRole('switch', { name: 'Auto' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('switch', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /^G string/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^G string/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('switch', { name: 'Auto' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.tuner-target')).toContainText('Target G');
});

test('reduced motion: calmer redraws and no marker animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await syntheticMic(page, A4);
  await openTuner(page);
  await expect(graph(page)).toHaveAttribute('data-reduced-motion', 'true');
  expect(await page.locator('.trail-marker').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-status')).toHaveText('In tune', { timeout: 5000 });
  await expect.poll(async () => (await data(page)).live).toBe('true');
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('360 px portrait: graph, pegs, and Start/Stop fit together with touch-sized controls', async ({ page }) => {
  await syntheticMic(page, A4);
  await page.setViewportSize({ width: 360, height: 740 });
  await openTuner(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.waitForTimeout(800); // scroll-into-view on start
  const box = await page.evaluate(() => {
    const g = document.querySelector('.tuner-graph')!.getBoundingClientRect();
    const s = document.querySelector('.tuner-start')!.getBoundingClientRect();
    return { graphTop: g.top, startBottom: s.bottom, height: innerHeight };
  });
  expect(box.graphTop).toBeGreaterThanOrEqual(0);
  expect(box.startBottom).toBeLessThanOrEqual(box.height);
  const small = await page.locator('.peg-button, .auto-switch, .segmented.dark button, .tuner-start').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(e => e.textContent));
  expect(small).toEqual([]);
  // Peg buttons do not overlap one another.
  const pegs = await page.locator('.peg-button').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })));
  for (let i = 0; i < pegs.length; i++) for (let j = i + 1; j < pegs.length; j++) {
    const a = pegs[i], b = pegs[j];
    expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  }
  await page.screenshot({ path: 'test-results/tuner-360.png' });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('desktop layout and microphone cleanup when leaving the tuner', async ({ page }) => {
  await syntheticMic(page, A4);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openTuner(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-status')).toHaveText('In tune', { timeout: 5000 });
  await page.screenshot({ path: 'test-results/tuner-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Home/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { micStops: number }).micStops)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
});
