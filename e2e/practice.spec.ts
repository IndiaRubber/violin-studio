import { expect, test, type Page } from '@playwright/test';

// A synthetic "microphone": an oscillator whose pitch and level the test controls.
// This exercises the real capture → Pitchy → engine → UI path, but it is not violin audio.
async function syntheticMic(page: Page, hz: number, level = 1) {
  await page.addInitScript(([initialHz, initialLevel]) => {
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
      Object.assign(window, { mic: { set: (f: number, g: number) => { oscillator.frequency.value = f; gain.gain.value = g; } } });
      return destination.stream;
    } } });
  }, [hz, level]);
}
const setMic = (page: Page, hz: number, level = 1) => page.evaluate(([f, g]) => (window as unknown as { mic: { set: (f: number, g: number) => void } }).mic.set(f, g), [hz, level]);

async function openPractice(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await expect(page.locator('.staff svg')).toBeVisible();
}

test('renders four whole notes in 4/4 with ledger lines and a tempo mark', async ({ page }) => {
  await openPractice(page);
  const svg = page.locator('.staff svg');
  await expect(svg).toHaveAttribute('data-note-durations', 'w w w w');
  await expect(page.getByRole('img', { name: /Treble clef staff, no key signature, 4\/4, measures 1 to 4 of 4: G3 whole note current, D4 whole note, A4 whole note, E5 whole note/ })).toBeVisible();
  await expect(svg.locator('text', { hasText: '=' }).or(svg.locator('text', { hasText: '60' })).first()).toBeVisible();
  await expect(page.getByText('4 beats = 4 s')).toBeVisible();
  // Each note sits in its own measure, left to right in written order.
  const xs = await page.locator('.note-hints:not(.fingering) span').evaluateAll(spans => spans.map(span => span.getBoundingClientRect().x));
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  await page.screenshot({ path: 'test-results/practice-whole-notes.png', fullPage: true });
});

test('sustained mode: finds G3, counts four beats, then advances (120 BPM)', async ({ page }) => {
  await syntheticMic(page, 196);
  await openPractice(page);
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Faster' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Tap Hear note/ })).toBeVisible();
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('120 BPM');
  await expect(page.getByText('4 beats = 2 s')).toBeVisible();
  const started = Date.now();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.hold-card')).toHaveClass(/is-holding/, { timeout: 5000 });
  await expect(page.getByText(/Hold it steady — beat/)).toBeVisible();
  await expect(page.getByText('Note 1 of 4')).toBeVisible(); // still holding: quick-mode timing is not enough
  await expect(page.getByText('Note 2 of 4')).toBeVisible({ timeout: 6000 });
  expect(Date.now() - started).toBeGreaterThan(2000);
  // Continuing the same G3 must not count toward D4.
  await expect(page.getByText(/Well held|Different note|A little/)).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText('Note 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('prolonged silence during a hold resets only the current note', async ({ page }) => {
  await syntheticMic(page, 196);
  await openPractice(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.hold-card')).toHaveClass(/is-holding/, { timeout: 5000 });
  await setMic(page, 196, 0);
  await expect(page.getByText(/sound stopped before the note’s full length/)).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.hold-card')).not.toHaveClass(/is-holding/);
  await expect(page.getByText('Note 1 of 4')).toBeVisible();
  await setMic(page, 196, 1);
  await expect(page.locator('.hold-card')).toHaveClass(/is-holding/, { timeout: 5000 });
  // Stopping the microphone mid-hold cancels the partial hold.
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  await expect(page.locator('.hold-card')).not.toHaveClass(/is-holding/);
  await expect(page.getByText('Note 1 of 4')).toBeVisible();
});

test('reference tone plays on demand and cannot satisfy the exercise', async ({ page }) => {
  await syntheticMic(page, 196, 0);
  await openPractice(page);
  await page.getByRole('button', { name: 'Quick check' }).click(); // most permissive mode: 350 ms would normally pass
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.getByRole('button', { name: /Hear note/ }).click();
  // Simulate the phone speaker leaking the exact target pitch into the microphone.
  await setMic(page, 196, 1);
  await expect(page.getByText(/Playing the reference G3 — microphone paused/)).toBeVisible();
  await expect(page.getByText('Listening is paused while the reference note plays.')).toBeVisible();
  await page.waitForTimeout(1200);
  await setMic(page, 196, 0);
  await expect(page.locator('.tone-status')).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByText('Note 1 of 4')).toBeVisible();
  // Restarting the exercise while the reference plays keeps the microphone paused.
  await page.getByRole('button', { name: /Hear note/ }).click();
  await setMic(page, 196, 1);
  await page.getByRole('button', { name: 'Restart exercise' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Listening is paused while the reference note plays.')).toBeVisible();
  await setMic(page, 196, 0);
  await expect(page.locator('.tone-status')).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByText('Note 1 of 4')).toBeVisible();
  // The student now plays the note: recognition works normally again.
  await setMic(page, 196, 1);
  await expect(page.getByText('Note 2 of 4')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('practice controls: string focus, tempo, hints, restart, and persistence', async ({ page }) => {
  await openPractice(page);
  await page.getByRole('button', { name: 'A4', exact: true }).click();
  await expect(page.getByRole('img', { name: /A4 whole note current, A4 whole note, A4 whole note, A4 whole note/ })).toBeVisible();
  await expect(page.getByText('Exercise 01 / A4 focus')).toBeVisible();
  await page.getByRole('button', { name: 'Slower' }).click();
  await page.getByRole('button', { name: 'Slower' }).click();
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('50 BPM');
  await expect(page.getByText('4 beats = 4.8 s')).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Slower' }).click();
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('40 BPM');
  await expect(page.getByRole('button', { name: 'Slower' })).toBeDisabled();
  await expect(page.getByText('4 beats = 6 s')).toBeVisible();
  await page.getByRole('button', { name: 'Hidden', exact: true }).click();
  await expect(page.locator('.target-card strong')).toHaveText('?');
  await expect(page.getByRole('button', { name: 'Restart note' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart exercise' }).click();
  await expect(page.getByText('Note 1 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await expect(page.locator('.hold-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Faster' })).toBeDisabled(); // tempo only applies to sustained notes
  await page.reload();
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await expect(page.getByRole('button', { name: 'Quick check' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('40 BPM');
  await expect(page.locator('.target-card strong')).toHaveText('?');
  await page.getByRole('button', { name: 'Guided: find & hold' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(page.locator('output[aria-label="Tempo"]')).toHaveText('45 BPM');
});

test('practice screen fits a 360 px phone with touch-sized controls', async ({ page }) => {
  await syntheticMic(page, 196);
  await page.setViewportSize({ width: 360, height: 740 });
  await openPractice(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.waitForTimeout(800); // allow the smooth scroll that brings the practice area into view
  // Staff, target, detected pitch, intonation, hold and the main controls are all on screen together.
  const box = await page.evaluate(() => {
    const top = document.querySelector('.score-card')!.getBoundingClientRect().top;
    const bottom = document.querySelector('.actions')!.getBoundingClientRect().bottom;
    return { top, bottom, height: innerHeight };
  });
  expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.bottom).toBeLessThanOrEqual(box.height);
  const small = await page.locator('.actions button, .tone-button, .stepper button, .chips button, .segmented button').evaluateAll(buttons => buttons.filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(b => b.textContent));
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/practice-360-listening.png' });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});
