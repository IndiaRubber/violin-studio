import { expect, test } from '@playwright/test';

test('the mobile toolbar offers a tempo-linked pulse with optional audio and an adjustable trainer tempo', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.getByRole('button', { name: /Open Strings/ }).click();
  const metronome = page.getByRole('button', { name: 'Metronome', exact: true });
  const settings = page.getByRole('button', { name: /^Metronome settings,/ });
  const tempo = page.getByLabel('Tempo', { exact: true });
  await expect(metronome).toHaveAttribute('aria-pressed', 'false');
  await expect(settings).toHaveAccessibleName(`Metronome settings, ${await tempo.textContent()}`);
  await settings.click();
  await page.getByRole('checkbox', { name: 'Click sound' }).uncheck();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await metronome.click();
  await expect(metronome).toHaveAttribute('data-pulse', 'true');
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
  await page.getByRole('button', { name: 'Faster', exact: true }).click();
  await expect(settings).toHaveAccessibleName(`Metronome settings, ${await tempo.textContent()}`);
  await expect(metronome).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '← Exercises' }).click();
  await page.getByRole('button', { name: /Fingerboard Trainer/ }).click();
  await expect(metronome).toHaveAttribute('aria-pressed', 'false');
  await expect(settings).toHaveAccessibleName('Metronome settings, 60 BPM');
  await settings.click();
  await page.getByRole('button', { name: 'Slower metronome' }).click();
  await expect(page.getByLabel('Metronome tempo')).toHaveText('55 BPM');
  await expect(settings).toHaveAccessibleName('Metronome settings, 55 BPM');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('real generated clicks fed into the synthetic mic do not score, and a violin-like pitch still does', async ({ page }) => {
  await page.addInitScript(() => {
    let stream: AudioContext | undefined;
    let output: MediaStreamAudioDestinationNode | undefined;
    let clicks = 0;
    const realStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, ...args) {
      // Feed the actual click waveform into the synthetic mic at elevated gain.
      // Skip this hook for the injected copy and for the longer violin references.
      if (this.buffer && this.buffer.duration < 0.03 && this.context !== stream) {
        clicks++;
        if (stream && output) {
          const input = stream.createBufferSource();
          const gain = stream.createGain();
          gain.gain.value = 1.75;
          input.buffer = this.buffer;
          input.connect(gain).connect(output);
          realStart.call(input, stream.currentTime + Math.max(0, when - this.context.currentTime));
        }
      }
      return realStart.call(this, when, ...args);
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      stream = new AudioContext();
      output = stream.createMediaStreamDestination();
      const note = stream.createOscillator(), gain = stream.createGain();
      note.frequency.value = 293.6648;
      gain.gain.value = 0;
      note.connect(gain).connect(output);
      note.start();
      Object.assign(window, { playNote: () => { gain.gain.value = 0.5; } });
      await stream.resume();
      return output.stream;
    } } });
    Object.assign(window, { clickCount: () => clicks });
  });
  const count = () => page.evaluate(() => (window as unknown as { clickCount: () => number }).clickCount());
  await page.goto('/');
  await page.getByRole('button', { name: /Fingerboard Trainer/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  const metronome = page.getByRole('button', { name: 'Metronome', exact: true });
  await metronome.click();
  await expect.poll(count).toBeGreaterThanOrEqual(3);
  await expect(page.getByText('Note 1 of 9')).toBeVisible();
  await page.evaluate(() => (window as unknown as { playNote: () => void }).playNote());
  await expect(page.getByText('Note 2 of 9')).toBeVisible();
  await expect(metronome).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '← Exercises' }).click();
  const countAfterNavigation = await count();
  await page.waitForTimeout(1100);
  expect(await count()).toBe(countAfterNavigation);
});
