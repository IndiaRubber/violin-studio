import { expect, test, type Page } from '@playwright/test';

async function mic(page: Page, hz = 293.6648, level = 0) {
  await page.addInitScript(([frequency, volume]) => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const output = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency; gain.gain.value = volume;
      oscillator.connect(gain).connect(output); oscillator.start(); await context.resume();
      Object.assign(window, { trainerMic: { set: (hz: number, level: number) => { oscillator.frequency.value = hz; gain.gain.value = level; }, track: output.stream.getAudioTracks()[0] } });
      return output.stream;
    } } });
  }, [hz, level]);
}
const setMic = (page: Page, hz: number, level: number) => page.evaluate(([f, g]) => (window as unknown as { trainerMic: { set: (hz: number, level: number) => void } }).trainerMic.set(f, g), [hz, level]);
async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: /Fingerboard Trainer/ }).click(); await expect(page.locator('.fb-chart-row')).toHaveCount(6); }

test('chart, staff, memory hints, and 360px layout remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 }); await open(page);
  await expect(page.locator('.fb-chart .active')).toContainText('D4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/m2e-start.png', fullPage: true });
  await page.getByRole('button', { name: 'Find the Note' }).click();
  await expect(page.locator('.fb-chart .active')).toHaveCount(0);
  await expect(page.locator('.fb-chart .fb-cell strong').first()).toHaveText('·');
  await expect(page.locator('.target-card strong')).not.toHaveText('·');
  await page.screenshot({ path: 'test-results/m2e-find-hidden.png', fullPage: true });
  await page.getByRole('button', { name: 'Full labels' }).click();
  await expect(page.locator('.fb-chart .fb-cell').filter({ hasText: 'F♯4' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Memory' }).click();
  await page.getByRole('button', { name: 'Reveal current position' }).click();
  await expect(page.locator('.fb-chart .active strong')).not.toHaveText('·');
  await page.getByRole('button', { name: 'Staff + Fingerboard' }).click();
  await expect(page.locator('.staff svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/m2e-staff-chart.png', fullPage: true });
});

test('synthetic microphone advances a walk, wrong pitch waits, and demo input is suppressed', async ({ page }) => {
  await mic(page); await open(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await setMic(page, 440, 1);
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await page.waitForTimeout(650);
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await page.getByRole('button', { name: 'Hear note' }).click();
  await setMic(page, 293.6648, 1);
  await expect(page.getByText(/Microphone paused/)).toBeVisible();
  await page.waitForTimeout(1000);
  await setMic(page, 293.6648, 0);
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await expect(page.getByText(/Microphone paused/)).toHaveCount(0, { timeout: 4000 });
  await setMic(page, 293.6648, 1);
  await expect(page.getByText('Note 2 of 9')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.fb-chart .done')).toHaveCount(1);
  await expect(page.locator('.feedback-card').filter({ hasText: 'Detected' }).locator('strong')).toHaveText('—');
  await page.screenshot({ path: 'test-results/m2e-progress.png', fullPage: true });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  await page.getByRole('button', { name: 'Restart sequence' }).click();
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
});

test('mode navigation stops microphone and reference playback', async ({ page }) => {
  await mic(page); await open(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.getByRole('button', { name: 'Hear note' }).click();
  await page.getByRole('button', { name: '← Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Hear the note. Find your sound.' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { trainerMic: { track: MediaStreamTrack } }).trainerMic.track.readyState)).toBe('ended');
  await page.getByRole('button', { name: /Instrument Tuner/ }).click();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
});

test('a full synthetic D-string walk completes with green positions', async ({ page }) => {
  await mic(page); await open(page);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  const walk = [293.6648, 329.6276, 369.9944, 391.9954, 440, 391.9954, 369.9944, 329.6276, 293.6648];
  for (let i = 0; i < walk.length; i++) {
    await setMic(page, walk[i], 1);
    if (i < walk.length - 1) await expect(page.getByText(`Note ${i + 2} of 9`)).toBeVisible({ timeout: 5000 });
    else await expect(page.getByText('Sequence complete. Repeat whenever you like.')).toBeVisible({ timeout: 5000 });
    if (i === 2) await page.screenshot({ path: 'test-results/m2e-progress.png', fullPage: true });
  }
  await expect(page.locator('.fb-chart .done')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/m2e-complete.png', fullPage: true });
  await page.getByRole('button', { name: 'Restart sequence' }).click();
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
});

test('390px, desktop, keyboard, and reduced motion keep controls usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const animation = await page.locator('.fb-cell').first().evaluate(node => getComputedStyle(node).animationName);
    expect(animation).toBe('none');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  }
});
