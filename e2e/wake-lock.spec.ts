import { expect, test } from '@playwright/test';

test('Home does not request a wake lock; practice releases and reacquires it with visibility', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { requests: 0, releases: 0 };
    Object.assign(window, { wakeTest: state });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
      state.requests++;
      const sentinel = new EventTarget() as EventTarget & { released: boolean; release: () => Promise<void> };
      sentinel.released = false;
      sentinel.release = async () => { if (!sentinel.released) { sentinel.released = true; state.releases++; sentinel.dispatchEvent(new Event('release')); } };
      return sentinel;
    } } });
  });
  await page.goto('/');
  expect(await page.evaluate(() => (window as unknown as { wakeTest: { requests: number } }).wakeTest.requests)).toBe(0);
  await expect(page.getByRole('checkbox', { name: 'Keep screen awake during practice' })).toBeChecked();
  await page.getByRole('button', { name: /D-String Walk/ }).click();
  await expect(page.getByText('Screen awake during practice')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByText('Screen awake during practice')).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByText('Screen awake during practice')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { wakeTest: { requests: number; releases: number } }).wakeTest)).toEqual({ requests: 2, releases: 1 });
  await page.getByRole('button', { name: '← Exercises' }).click();
  expect(await page.evaluate(() => (window as unknown as { wakeTest: { requests: number; releases: number } }).wakeTest.releases)).toBe(2);
  await page.getByRole('checkbox', { name: 'Keep screen awake during practice' }).uncheck();
  await page.getByRole('button', { name: /Fingerboard Trainer/ }).click();
  expect(await page.evaluate(() => (window as unknown as { wakeTest: { requests: number } }).wakeTest.requests)).toBe(2);
});

test('unsupported and rejected wake locks never claim an active screen lock', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { throw new Error('battery saver'); } } }); });
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await expect(page.getByText('Screen may sleep; wake lock was not granted')).toBeVisible();
  await expect(page.getByText('Screen awake during practice')).toHaveCount(0);
});
