import { expect, test } from '@playwright/test';

test('opens exercise and renders the open strings on a treble staff', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await expect(page.getByRole('heading', { name: 'Open Strings Practice' })).toBeVisible();
  await expect(page.locator('.staff svg')).toBeVisible();
  await expect(page.getByRole('img', { name: /G3 whole note current, D4 whole note, A4 whole note, E5 whole note/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/exercise.png', fullPage: true });
  await page.getByText('Developer diagnostics').click();
  await expect(page.getByText('Raw frequency')).toBeVisible();
  await page.getByRole('button', { name: 'Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
});

test('requests the microphone only after starting and explains denial', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied');
});

test('quick check mode advances from G3 using a synthetic microphone stream', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 196;
      oscillator.connect(destination);
      oscillator.start();
      await context.resume();
      return destination.stream;
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByText('Note 2 of 4')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});

test('tuner shows synthetic A4 and updates cents when concert pitch changes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      oscillator.connect(destination); oscillator.start(); await context.resume();
      Object.assign(window, { tunerOscillator: oscillator });
      return destination.stream;
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('A4', { timeout: 5000 });
  await expect(page.locator('.tuner-status')).toHaveText('In tune');
  await page.screenshot({ path: 'test-results/tuner.png', fullPage: true });
  await page.getByRole('button', { name: /G3.*196/ }).click();
  await page.evaluate(() => { (window as unknown as { tunerOscillator: OscillatorNode }).tunerOscillator.frequency.value = 196 * 2 ** (-51 / 1200); });
  await expect(page.locator('.tuner-status')).toContainText('Very flat', { timeout: 5000 });
  await expect(page.locator('.tuner-note')).toHaveText('F♯3');
  await page.evaluate(() => { (window as unknown as { tunerOscillator: OscillatorNode }).tunerOscillator.frequency.value = 293.66; });
  await expect(page.locator('.tuner-status')).toContainText('nearer D4', { timeout: 5000 });
  await page.getByRole('button', { name: /A4.*440/ }).click();
  await page.evaluate(() => { (window as unknown as { tunerOscillator: OscillatorNode }).tunerOscillator.frequency.value = 440; });
  await expect(page.locator('.tuner-status')).toHaveText('In tune', { timeout: 5000 });
  await page.getByRole('spinbutton', { name: 'Concert pitch A4' }).fill('442');
  await expect(page.locator('.tuner-cents')).toContainText('-8 cents');
  await page.getByRole('button', { name: 'Chromatic' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('A4');
  await page.evaluate(() => { (window as unknown as { tunerOscillator: OscillatorNode }).tunerOscillator.frequency.value = 523.25; });
  await expect(page.locator('.tuner-note')).toHaveText('C5', { timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('—');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await expect(page.getByText('196.89 Hz')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(page.getByRole('spinbutton', { name: 'Concert pitch A4' })).toHaveValue('442');
  await page.getByRole('spinbutton', { name: 'Concert pitch A4' }).fill('500');
  await expect(page.getByRole('alert')).toContainText('415 to 466');
  await expect(page.getByRole('button', { name: /A4.*442/ })).toBeVisible();
  await expect(page.locator('.tuner-display')).not.toHaveAttribute('aria-live', /.+/);
});

test('tuner remains usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
  await expect(page.locator('.tuner-meter')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('navigating away during microphone startup releases the late stream', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { testStops: 0 });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const track = destination.stream.getAudioTracks()[0];
      const originalStop = track.stop.bind(track);
      track.stop = () => { (window as unknown as { testStops: number }).testStops++; originalStop(); };
      return destination.stream;
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { testStops: number }).testStops)).toBe(1);
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
});

test('switching from tuner to practice releases the active microphone first', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { captureCalls: 0, captureStops: 0 });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const counters = window as unknown as { captureCalls: number; captureStops: number };
      counters.captureCalls++;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      oscillator.connect(destination); oscillator.start(); await context.resume();
      const track = destination.stream.getAudioTracks()[0];
      const originalStop = track.stop.bind(track);
      track.stop = () => { counters.captureStops++; oscillator.stop(); void context.close(); originalStop(); };
      return destination.stream;
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('A4', { timeout: 5000 });
  await page.getByRole('button', { name: 'Home' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { captureStops: number }).captureStops)).toBe(1);
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { captureCalls: number }).captureCalls)).toBe(2);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { captureStops: number }).captureStops)).toBe(2);
});
