import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('production app installs offline shell and keeps tuner and staff usable offline', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const output = audio.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      oscillator.connect(output); oscillator.start(); await audio.resume();
      Object.assign(window, { offlineOscillator: oscillator });
      return output.stream;
    } } });
  });
  await page.goto('/');
  await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto('/tuner'); // navigation fallback loads the shell on direct refresh
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.tuner-note')).toHaveText('A4', { timeout: 5000 });
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await expect(page.locator('.staff svg')).toBeVisible();
  expect(await page.locator('.staff svg path').count()).toBeGreaterThan(0);
  // Milestone 2A features work with the network off.
  await expect(page.locator('.staff svg')).toHaveAttribute('data-note-durations', 'w w w w');
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(page.getByText('4 beats = 3.7 s')).toBeVisible();
  await page.getByRole('button', { name: /Hear note/ }).click();
  await expect(page.getByText(/Playing the reference G3/)).toBeVisible();
  await expect(page.locator('.tone-status')).toHaveCount(0, { timeout: 4000 });
  // Milestone 2B: every library exercise is bundled and opens offline.
  await page.getByRole('button', { name: '← Exercises' }).click();
  await expect(page.locator('.library .exercise-card')).toHaveCount(10);
  await page.getByRole('button', { name: /D Major Scale/ }).click();
  await expect(page.getByRole('img', { name: /key of D major/ })).toBeVisible();
  await expect(page.locator('.staff svg')).toHaveAttribute('data-note-durations', /^h h/);
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /Two-String Tune/ }).click();
  await expect(page.locator('.staff svg')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
});

test('new service worker waits for an explicit update action', async ({ page }) => {
  const workerPath = resolve('dist/sw.js');
  const original = await readFile(workerPath, 'utf8');
  try {
    await page.goto('/');
    await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await writeFile(workerPath, `${original}\n/* update verification */\n`);
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)), { timeout: 10000 }).toBe(true);
    await expect(page.getByText('New version ready.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
    await page.getByRole('button', { name: 'Update now' }).click();
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting === null), { timeout: 10000 }).toBe(true);
    await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
  } finally { await writeFile(workerPath, original); }
});

test('production PWA fits a narrow Android viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(page.locator('.tuner-meter')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
