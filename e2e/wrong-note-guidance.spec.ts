import { expect, test, type Page } from '@playwright/test';

async function syntheticMic(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
      gain.gain.value = 0; oscillator.connect(gain).connect(output); oscillator.start(); await context.resume();
      Object.assign(window, { testMic: { set: (hz: number, level: number) => { oscillator.frequency.value = hz; gain.gain.value = level; } } });
      return output.stream;
    } } });
  });
}
const setMic = (page: Page, hz: number, level = 1) => page.evaluate(([frequency, volume]) => (window as unknown as { testMic: { set: (hz: number, level: number) => void } }).testMic.set(frequency, volume), [hz, level]);
const atCents = (target: number, cents: number) => target * 2 ** (cents / 1200);

for (const [lesson, prefix, before, target, heard, next] of [
  ['D-String Walk', [293.6648, 329.6276], 369.9944, 369.9944, 'F natural', 'Note 4 of 7'],
  ['A-String Walk', [440, 493.8833], 554.3653, 554.3653, 'C natural', 'Note 4 of 7'],
] as const) {
  test(`${lesson} gives the same second-finger advice at −99 and −101 cents without scoring the wrong note`, async ({ page }) => {
    await syntheticMic(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(lesson) }).click();
    await page.getByRole('button', { name: 'Quick check' }).click();
    await page.getByRole('button', { name: 'Start Listening' }).click();
    for (const [i, hz] of prefix.entries()) {
      await setMic(page, hz);
      await expect(page.getByText(`Note ${i + 2} of 7`)).toBeVisible({ timeout: 5000 });
    }
    for (const cents of [-99, -101]) {
      await setMic(page, atCents(before, cents));
      await expect(page.getByText(new RegExp(`Hearing ${heard}\\. For`))).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Note 3 of 7')).toBeVisible();
    }
    await page.waitForTimeout(500);
    await expect(page.getByText('Note 3 of 7')).toBeVisible();
    await setMic(page, target);
    await expect(page.getByText(next)).toBeVisible({ timeout: 5000 });
  });
}

test('hidden fingering offers a current-note hint without saving it or revealing later notes', async ({ page }) => {
  await syntheticMic(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /D-String Walk/ }).click();
  await page.getByRole('checkbox', { name: /Show suggested string & finger/ }).uncheck();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  for (const [i, hz] of [293.6648, 329.6276].entries()) {
    await setMic(page, hz);
    await expect(page.getByText(`Note ${i + 2} of 7`)).toBeVisible({ timeout: 5000 });
  }
  await setMic(page, atCents(369.9944, -101));
  await expect(page.getByText('Hearing F natural. Check F♯4 on the staff.')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.target-card .fingering-hint')).toHaveCount(0);
  await expect(page.locator('.note-hints.fingering')).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('violin-studio-practice'));
  await page.getByRole('button', { name: 'Show hint for this note' }).click();
  await expect(page.getByText('Hearing F natural. For F♯, place your second finger close to your third.')).toBeVisible();
  await expect(page.locator('.target-card .fingering-hint')).toHaveText('D string · 2nd finger (high)');
  expect(await page.evaluate(() => localStorage.getItem('violin-studio-practice'))).toBe(saved);
  await setMic(page, 369.9944);
  await expect(page.getByText('Note 4 of 7')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.target-card .fingering-hint')).toHaveCount(0);
  await expect(page.locator('.note-hints.fingering')).toHaveCount(0);
});

test('the pattern challenge keeps its answer locked before Show answer', async ({ page }) => {
  await syntheticMic(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Spot It Before You Play/ }).click();
  await page.getByRole('button', { name: 'Quick check' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await setMic(page, atCents(369.9944, -100));
  await expect(page.getByText('Note 1 of 5')).toBeVisible();
  await page.waitForTimeout(650);
  await expect(page.getByRole('button', { name: 'Show hint for this note' })).toHaveCount(0);
  await expect(page.locator('.target-card .fingering-hint')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
});
