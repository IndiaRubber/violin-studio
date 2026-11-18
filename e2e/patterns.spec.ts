import { expect, test, type Page } from '@playwright/test';

// Controlled oscillator drives the real capture → detector → exercise path; not violin input.
async function syntheticMic(page: Page, hz = 1000, level = 0) {
  await page.addInitScript(([frequency, volume]) => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const output = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain).connect(output);
      oscillator.start(); await context.resume();
      Object.assign(window, { patternMic: { set: (hz: number, level: number) => { oscillator.frequency.value = hz; gain.gain.value = level; } } });
      return output.stream;
    } } });
  }, [hz, level]);
}
const setMic = (page: Page, hz: number, level = 1) => page.evaluate(([frequency, volume]) => (window as unknown as { patternMic: { set: (hz: number, level: number) => void } }).patternMic.set(frequency, volume), [hz, level]);
const open = async (page: Page, title: string) => {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.staff svg')).toBeVisible();
};

test('new section teaches high and low second finger with distinct staff notation and optional cue', async ({ page }) => {
  await open(page, 'Move One Finger');
  await expect(page.getByRole('heading', { name: 'Finger Patterns' })).toHaveCount(0); // only on library
  await expect(page.getByRole('img', { name: /E4 half note current, F♯4 half note, G4 whole note/ })).toBeVisible();
  await expect(page.getByText('Fingers 2 and 3 close: F♯ to G is a half step.')).toBeVisible();
  await expect(page.locator('.pattern-group-list li')).toHaveCount(2);
  await page.getByText('Show relative finger spacing').click();
  await expect(page.getByRole('img', { name: /fingers 2–3 close together; relative spacing only/ })).toBeVisible();
  await page.getByLabel('Show finger pattern cue').uncheck();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await expect(page.locator('.staff svg')).toBeVisible();
  await page.getByLabel('Show finger pattern cue').check();
  await expect(page.locator('.pattern-guide')).toBeVisible();
});

test('shape drill links to unchanged D major scale with optional group markers', async ({ page }) => {
  await open(page, 'Move the Shape');
  await expect(page.locator('.pattern-group-list')).toContainText('D string shape');
  await expect(page.locator('.pattern-group-list')).toContainText('A string shape');
  await page.getByRole('button', { name: /Try D Major Scale/ }).click();
  await expect(page.getByRole('heading', { name: 'D Major Scale' })).toBeVisible();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await page.getByLabel('Show finger pattern cue').check();
  await expect(page.locator('.pattern-group-list')).toContainText('D string group');
  await expect(page.locator('.pattern-group-list')).toContainText('A string group');
  await expect(page.getByRole('img', { name: /key of D major/ })).toBeVisible();
});

test('Morning Steps challenge hides answer and finger hints until reveal, then allows hiding again', async ({ page }) => {
  await open(page, 'Spot It Before You Play');
  await expect(page.getByText('Look before you listen')).toBeVisible();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await expect(page.locator('.note-hints.fingering')).toHaveCount(0);
  await expect(page.getByLabel(/Show suggested string & finger/)).toBeDisabled();
  await expect(page.getByLabel(/Show finger pattern cue/)).toBeDisabled();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.locator('.pattern-guide')).toContainText('F♯ and G are the close pair');
  await page.getByLabel('Show finger pattern cue').uncheck();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await expect(page.locator('.staff svg')).toBeVisible();
  await page.getByRole('button', { name: 'Guided: find & hold' }).click();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
});

test('pattern demo suppresses the microphone through all notes, gaps and settling, even on restart', async ({ page }) => {
  await syntheticMic(page);
  await open(page, 'Move One Finger');
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.getByRole('button', { name: 'Hear pattern' }).click();
  await setMic(page, 329.63);
  await expect(page.getByText('Playing the pattern — microphone paused throughout')).toBeVisible();
  await expect(page.getByText('Listening is paused while the reference note plays.')).toBeVisible();
  await page.waitForTimeout(2400); // three 520 ms tones, two 130 ms gaps, and 400 ms settling
  await setMic(page, 1000, 0);
  await expect(page.getByText('Note 1 of 10')).toBeVisible();
  await page.getByRole('button', { name: 'Hear pattern' }).click();
  await setMic(page, 329.63);
  await page.getByRole('button', { name: 'Restart exercise' }).click();
  await expect(page.getByText('Note 1 of 10')).toBeVisible();
  await expect(page.getByText('Playing the pattern — microphone paused throughout')).toHaveCount(0);
  await setMic(page, 1000, 0);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('360px phrase crosses a score page while the revealed cue remains understandable', async ({ page }) => {
  await syntheticMic(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'Spot It Before You Play');
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.locator('.pattern-guide')).toContainText('Morning Steps, measures 3–4');
  await expect(page.getByText('Measures 1–2 of 3')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  for (const [index, hz] of [369.99, 293.66, 329.63, 369.99].entries()) {
    await setMic(page, hz);
    await expect(page.getByText(`Note ${index + 2} of 5`)).toBeVisible({ timeout: 5000 });
  }
  await expect(page.getByText('Measures 3–3 of 3')).toBeVisible();
  await expect(page.locator('.pattern-guide')).toContainText('F♯ and G are the close pair');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await setMic(page, 392);
  await expect(page.getByRole('button', { name: 'Repeat with cue hidden' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Repeat with cue hidden' }).click();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
});

test('05H lets a learner inspect both phone score pages before revealing the answer or listening', async ({ page }) => {
  await syntheticMic(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'Spot the Change in a Tune');
  await expect(page.getByText('Measures 1–2 of 4')).toBeVisible();
  await expect(page.locator('.pattern-guide')).toHaveCount(0);
  await expect(page.locator('.note-hints.fingering')).toHaveCount(0);
  await expect(page.getByLabel(/Show finger pattern cue/)).toBeDisabled();
  await page.getByRole('button', { name: 'Next score page' }).click();
  await expect(page.getByText('Measures 3–4 of 4')).toBeVisible();
  await expect(page.getByRole('img', { name: /B4 half note, C5 half note, D5 half note, B4 half note/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Previous score page' }).click();
  await expect(page.getByText('Measures 1–2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.locator('.pattern-group-list')).toContainText('D string: high 2');
  await expect(page.locator('.pattern-group-list')).toContainText('A string: low 2');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Next score page' })).toHaveCount(0);
  await expect(page.getByText('Measures 1–2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('05E identical A4s require a credible release in the synthetic microphone path', async ({ page }) => {
  await syntheticMic(page);
  await open(page, 'Add the Fourth Finger');
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  for (const [index, hz] of [329.63, 369.99, 392, 440].entries()) {
    await setMic(page, hz);
    await expect(page.getByText(`Note ${index + 2} of 6`)).toBeVisible({ timeout: 5000 });
  }
  await page.waitForTimeout(650);
  await expect(page.getByText('Note 5 of 6')).toBeVisible();
  await setMic(page, 440, 0);
  // Wait for the engine to observe a credible release; a fixed pause can elapse
  // without enough audio-analysis frames when other browser tests share the CPU.
  await expect(page.getByText('Waiting for a note…')).toBeVisible({ timeout: 5000 });
  await setMic(page, 440);
  await expect(page.getByText('Note 6 of 6')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});
