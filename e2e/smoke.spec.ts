import { expect, test } from '@playwright/test';

test('opens exercise and renders the open strings on a treble staff', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings Practice/ }).click();
  await expect(page.getByRole('heading', { name: 'Open Strings Practice' })).toBeVisible();
  await expect(page.locator('.staff svg')).toBeVisible();
  await expect(page.getByRole('img', { name: /G3 current, D4, A4, E5/ })).toBeVisible();
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

test('advances from G3 using a synthetic microphone stream', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByText('Note 2 of 4')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
});
