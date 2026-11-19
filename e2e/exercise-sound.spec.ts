import { expect, test, type Page } from '@playwright/test';

async function mic(page: Page, hz = 329.6276, level = 0) {
  await page.addInitScript(([frequency, volume]) => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency; gain.gain.value = volume;
      oscillator.connect(gain).connect(output); oscillator.start(); await context.resume();
      Object.assign(window, { exerciseMic: { set: (f: number, g: number) => { oscillator.frequency.value = f; gain.gain.value = g; } } });
      return output.stream;
    } } });
  }, [hz, level]);
}
const setMic = (page: Page, hz: number, level: number) => page.evaluate(([f, g]) => (window as unknown as { exerciseMic: { set: (f: number, g: number) => void } }).exerciseMic.set(f, g), [hz, level]);
const sound = (page: Page) => page.getByRole('group', { name: 'Hear note sound' });
async function open(page: Page, title: string) { await page.goto('/'); await page.getByRole('button', { name: new RegExp(title) }).click(); }

test('lesson preference persists across exercises but does not change tuner choice; A442 corrects a real clip', async ({ page }) => {
  await page.addInitScript(() => {
    const rates: number[] = []; Object.assign(window, { exerciseRates: rates });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { rates.push(this.playbackRate.value); return start.apply(this, args); };
  });
  await open(page, 'Move One Finger');
  await expect(sound(page).getByRole('button', { name: 'Tone' })).toHaveAttribute('aria-pressed', 'true');
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText(/Playing violin reference E4/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { exerciseRates: number[] }).exerciseRates.at(-1))).toBeCloseTo(329.6276 / 323.52, 3);
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(sound(page).getByRole('button', { name: 'Tone' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('spinbutton', { name: 'Concert pitch A4' }).fill('442');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await expect(sound(page).getByRole('button', { name: 'Violin' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'A4', exact: true }).click();
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText(/Playing violin reference A4/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { exerciseRates: number[] }).exerciseRates.at(-1))).toBeCloseTo(442 / 438.18, 3);
  await page.reload();
  await page.getByRole('button', { name: /Fingerboard Trainer/ }).click();
  await expect(sound(page).getByRole('button', { name: 'Violin' })).toHaveAttribute('aria-pressed', 'true');
});

test('D-string fourth-finger A4 and open A4 request different clips', async ({ page }) => {
  await mic(page);
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/samples/')) requested.push(request.url()); });
  await open(page, 'Add the Fourth Finger');
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  for (const [index, hz] of [329.6276, 369.9944, 391.9954].entries()) {
    await setMic(page, hz, 1);
    await expect(page.getByText(`Note ${index + 2} of 6`)).toBeVisible({ timeout: 5000 });
  }
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText(/Playing violin reference A4/)).toBeVisible();
  expect(requested.at(-1)).toContain('/samples/d-a4.wav');
  await page.locator('.reference-actions .tone-button').click();
  await setMic(page, 440, 0);
  await expect(page.locator('.tone-status')).toHaveCount(0);
  await setMic(page, 440, 1);
  await expect(page.getByText('Note 5 of 6')).toBeVisible({ timeout: 5000 });
  await setMic(page, 440, 0);
  await expect(page.getByText('Waiting for a note…')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText(/Playing violin reference A4/)).toBeVisible();
  expect(requested.at(-1)).toContain('/samples/a4.wav');
});

test('failed clip falls back visibly; loading, Tone, and settling cannot satisfy the mic', async ({ page }) => {
  await mic(page);
  await page.route('**/samples/d-e4.wav', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill({ status: 200, contentType: 'audio/wav', body: 'not a wav' }); });
  await open(page, 'Move One Finger');
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.getByRole('button', { name: /Hear note/ }).click();
  await setMic(page, 329.6276, 1);
  await expect(page.getByText('Loading violin reference — microphone paused')).toBeVisible();
  await expect(page.getByText('Violin recording unavailable. Tone is playing.')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(800);
  await expect(page.getByText('Note 1 of 10')).toBeVisible();
  await setMic(page, 329.6276, 0);
  await expect(page.locator('.tone-status')).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByText('Note 1 of 10')).toBeVisible();
  await setMic(page, 329.6276, 1);
  await expect(page.getByText('Note 2 of 10')).toBeVisible({ timeout: 5000 });
});

test('missing clip uses Tone, cancellation during loading prevents late playback, and selector fits 360px', async ({ page }) => {
  await mic(page, 196);
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, 'G Major Scale');
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/exercise-sound-360.png', fullPage: true });
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await setMic(page, 196, 1);
  await expect(page.getByText('Note 2 of 15')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText('No recording for this string and note. Tone is playing.')).toBeVisible();
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /Move One Finger/ }).click();
  await page.route('**/samples/d-e4.wav', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({ status: 200, path: 'public/samples/d-e4.wav' }).catch(() => {}); });
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText('Loading violin reference — microphone paused')).toBeVisible();
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Fingerboard Trainer pauses through violin playback, resumes, and cancels on sequence change', async ({ page }) => {
  await mic(page, 293.6648);
  await page.setViewportSize({ width: 360, height: 780 });
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/samples/')) requested.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: /Fingerboard Trainer/ }).click();
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/trainer-sound-360.png', fullPage: true });
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.getByRole('button', { name: 'Hear note' }).click();
  await expect(page.getByText('Playing violin reference. Microphone paused.')).toBeVisible();
  expect(requested.at(-1)).toContain('/samples/d4.wav');
  await setMic(page, 293.6648, 1);
  await page.waitForTimeout(900);
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await setMic(page, 293.6648, 0);
  await expect(page.getByText('Reference finished. Microphone settling.')).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await expect(page.getByText('Waiting for a clear note.')).toBeVisible({ timeout: 4000 });
  await setMic(page, 293.6648, 1);
  await expect(page.getByText('Note 2 of 9')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Hear note' }).click();
  await expect(page.getByText('Playing violin reference. Microphone paused.')).toBeVisible();
  expect(requested.at(-1)).toContain('/samples/d-e4.wav');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await expect(page.getByText('Playing violin reference. Microphone paused.')).toHaveCount(0);
});

test('violin reference cannot start or extend a Guided hold', async ({ page }) => {
  await mic(page);
  await open(page, 'Move One Finger');
  await sound(page).getByRole('button', { name: 'Violin' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.getByRole('button', { name: /Hear note/ }).click();
  await setMic(page, 329.6276, 1);
  await expect(page.getByText(/Playing violin reference E4/)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.locator('.score-hold-graphic')).not.toHaveClass(/is-holding/);
  await setMic(page, 329.6276, 0);
  await expect(page.locator('.tone-status')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('.score-hold-graphic')).not.toHaveClass(/is-holding/);
  await setMic(page, 329.6276, 1);
  await expect(page.locator('.score-hold-graphic')).toHaveClass(/is-holding/, { timeout: 5000 });
});
