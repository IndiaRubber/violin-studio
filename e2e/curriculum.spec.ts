import { expect, test, type Page } from '@playwright/test';

// Synthetic microphone: an oscillator the test retunes. Not violin audio.
async function syntheticMic(page: Page, hz: number, level = 1) {
  await page.addInitScript(([initialHz, initialLevel]) => {
    Object.assign(window, { micStops: 0 });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = initialHz;
      gain.gain.value = initialLevel;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      await context.resume();
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
const HZ: Record<string, number> = { G3: 196.0, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, 'F♯4': 369.99, G4: 392.0, A4: 440, B4: 493.88, 'C♯5': 554.37, D5: 587.33 };

async function open(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.staff svg')).toBeVisible();
}
/** Quick check: play notes in order; a pitch change counts as the release between notes. */
async function playQuick(page: Page, names: string[]) {
  for (const name of names) {
    const before = Number((await page.locator('.progress-label span').last().textContent())!.split(' ')[0]);
    await setMic(page, HZ[name]);
    await expect(page.locator('.progress-label span').last()).toHaveText(`${before + 1} complete`, { timeout: 4000 }).catch(async () => {
      if (!(await page.getByText('Exercise complete').isVisible())) throw new Error(`did not accept ${name}`);
    });
  }
}

test('library lists the curriculum and every exercise renders valid notation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const cards = page.locator('.library .exercise-card');
  await expect(cards).toHaveCount(10);
  const numbers = await page.locator('.card-number').allTextContents();
  expect(numbers).toEqual(['01', '02', '03', '04', '05', '06', '07', '08A', '08B', '08C']);
  for (let i = 0; i < 10; i++) {
    await cards.nth(i).click();
    const svg = page.locator('.staff svg');
    await expect(svg).toBeVisible();
    expect((await svg.getAttribute('data-note-durations'))!.split(' ').every(d => d === 'w' || d === 'h')).toBe(true);
    await page.getByRole('button', { name: '← Exercises' }).click();
  }
  expect(errors).toEqual([]);
});

test('D major scale: key signature, half notes, ascending and descending (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'D Major Scale');
  const svg = page.locator('.staff svg');
  await expect(svg).toHaveAttribute('data-measures', '1-8');
  await expect(svg).toHaveAttribute('data-note-durations', 'h h h h h h h h h h h h h h w');
  await expect(page.getByRole('img', { name: /key of D major, 4\/4, measures 1 to 8 of 8: D4 half note current, E4 half note, F♯4 half note, G4 half note, A4 half note, B4 half note, C♯5 half note, D5 half note, C♯5 half note, B4 half note, A4 half note, G4 half note, F♯4 half note, E4 half note, D4 whole note/ })).toBeVisible();
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('80 BPM');
  await expect(page.getByText('half note = 2 beats = 1.5 s')).toBeVisible();
  await expect(page.locator('.hold-card .beat')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/d-major-desktop.png', fullPage: true });
});

test('G major scale renders one sharp and low ledger-line notes', async ({ page }) => {
  await open(page, 'G Major Scale');
  await expect(page.getByRole('img', { name: /key of G major, 4\/4.*G3 half note current, A3 half note, B3 half note, C4 half note/ })).toBeVisible();
});

test('narrow phone shows a window of measures that turns as the scale progresses', async ({ page }) => {
  await syntheticMic(page, 1000, 0);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'D Major Scale');
  await expect(page.getByText('Measures 1–2 of 8')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.waitForTimeout(800); // let the intentional scroll-into-view on Start finish
  const scrollBefore = await page.evaluate(() => scrollY);
  await playQuick(page, ['D4', 'E4', 'F♯4', 'G4']);
  await expect(page.getByText(/Measures 3–\d of 8/)).toBeVisible();
  await expect(page.getByText('Note 5 of 15')).toBeVisible();
  expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThan(2); // page turn does not scroll
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/d-major-360-page2.png' });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('guided half notes: holds two beats at 120 BPM then advances', async ({ page }) => {
  await syntheticMic(page, HZ.D4);
  await open(page, 'D Major Scale');
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Faster' }).click();
  await expect(page.getByText('half note = 2 beats = 1 s')).toBeVisible();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.hold-card')).toHaveClass(/is-holding/, { timeout: 5000 });
  await expect(page.getByText('Note 2 of 15')).toBeVisible({ timeout: 4000 });
  await setMic(page, HZ.E4);
  await expect(page.getByText('Note 3 of 15')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('fingering hints: on by default early, off for scales, optional and remembered', async ({ page }) => {
  await open(page, 'D-String Walk');
  await expect(page.locator('.note-hints.fingering')).toContainText('D↑2');
  await expect(page.getByText('D string · open')).toBeVisible();
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /D Major Scale/ }).click();
  await expect(page.locator('.note-hints.fingering')).toHaveCount(0);
  await page.getByLabel('Show suggested string & finger').check();
  await expect(page.locator('.note-hints.fingering')).toContainText('D0');
  await page.reload();
  await page.getByRole('button', { name: /D Major Scale/ }).click();
  await expect(page.getByLabel('Show suggested string & finger')).toBeChecked();
});

test('note names can be revealed only after each note is played, or hidden', async ({ page }) => {
  await syntheticMic(page, 1000, 0);
  await open(page, 'D-String Walk');
  await page.getByRole('button', { name: 'After playing' }).click();
  const names = page.locator('.note-hints:not(.fingering) span');
  await expect(names).toHaveText(['Now', '·', '·', '·', '·', '·', '·']);
  await expect(page.locator('.target-card strong')).toHaveText('?');
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await playQuick(page, ['D4']);
  await expect(names).toHaveText(['D4', 'Now', '·', '·', '·', '·', '·']);
  await page.getByRole('button', { name: 'Hidden', exact: true }).click();
  await expect(names).toHaveText(['✓', 'Now', '·', '·', '·', '·', '·']);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('completing an exercise shows a factual summary and offers repeat and next', async ({ page }) => {
  await syntheticMic(page, 1000, 0);
  await open(page, 'D-String Walk');
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await playQuick(page, ['D4', 'E4', 'F♯4', 'G4', 'F♯4', 'E4', 'D4']);
  await expect(page.getByText('Exercise complete')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: 'D-String Walk' })).toBeVisible();
  await expect(page.locator('.summary')).toContainText('7 (D4, E4, F♯4, G4)');
  await expect(page.locator('.summary')).toContainText('Quick check');
  await expect(page.getByText(/does not judge bowing, posture, finger placement, or tone/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { micStops: number }).micStops)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Practice again' }).click();
  await expect(page.getByRole('heading', { name: 'D-String Walk' })).toBeVisible();
  await expect(page.getByText('Note 1 of 7')).toBeVisible();
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /D-String Walk/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await playQuick(page, ['D4', 'E4', 'F♯4', 'G4', 'F♯4', 'E4', 'D4']);
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.getByRole('heading', { name: 'A-String Walk' })).toBeVisible();
});

test('changing exercise while listening releases the microphone and resets progress', async ({ page }) => {
  await syntheticMic(page, HZ.D4);
  await open(page, 'D Major Scale');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.hold-card')).toHaveClass(/is-holding/, { timeout: 5000 });
  await page.getByRole('button', { name: '← Exercises' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { micStops: number }).micStops)).toBeGreaterThan(0);
  await page.getByRole('button', { name: /G Major Scale/ }).click();
  await expect(page.getByText('Note 1 of 15')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
  await expect(page.getByRole('img', { name: /G3 half note current/ })).toBeVisible();
});
