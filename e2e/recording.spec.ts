import { expect, test, type Page } from '@playwright/test';

async function mockCapture(page: Page) {
  await page.addInitScript(() => {
    const state = { requests: 0, audioStopped: 0, videoStopped: 0, scoredStopped: 0, starts: 0, stops: 0, deny: false, empty: false };
    Object.assign(window, { captureTest: state });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, get() { return null; }, set() { /* mock tracks are not native */ } });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async (constraints: MediaStreamConstraints) => {
      state.requests++;
      if (state.deny) throw new DOMException('Permission denied', 'NotAllowedError');
      if (!constraints.video) {
        const context = new AudioContext(), oscillator = context.createOscillator(), output = context.createMediaStreamDestination();
        oscillator.frequency.value = 440; oscillator.connect(output); oscillator.start(); await context.resume();
        const track = output.stream.getAudioTracks()[0], stop = track.stop.bind(track);
        track.stop = () => { state.scoredStopped++; stop(); void context.close(); };
        return output.stream;
      }
      const audio = { kind: 'audio', onended: null, stop() { state.audioStopped++; } };
      const video = { kind: 'video', onended: null, stop() { state.videoStopped++; } };
      return { getTracks: () => [audio, video], getAudioTracks: () => [audio], getVideoTracks: () => [video] };
    } } });
    class MockRecorder {
      static isTypeSupported(type: string) { return type.includes('webm'); }
      state = 'inactive'; mimeType = 'video/webm'; ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(_stream: unknown, _options?: unknown) {}
      start() { this.state = 'recording'; state.starts++; }
      stop() { if (this.state !== 'recording') return; this.state = 'inactive'; state.stops++; this.ondataavailable?.({ data: state.empty ? new Blob() : new Blob(['video-data'], { type: 'video/webm' }) }); this.onstop?.(); }
    }
    Object.assign(window, { MediaRecorder: MockRecorder });
  });
}

async function startRecording(page: Page) {
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await page.getByRole('button', { name: 'Record Performance' }).click();
  await expect(page.getByLabel('Front camera preview')).toBeVisible();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText(/Recording begins in 3/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible({ timeout: 5000 });
}

test('camera setup becomes a score while recording continues; save, reopen, download, delete', async ({ page }) => {
  await mockCapture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await startRecording(page);
  await expect(page.getByLabel('Front camera preview')).toHaveCount(0);
  await expect(page.locator('.staff svg')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { captureTest: { starts: number; stops: number } }).captureTest)).toMatchObject({ starts: 1, stops: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByLabel('Recorded performance playback')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { captureTest: { audioStopped: number; videoStopped: number } }).captureTest)).toMatchObject({ audioStopped: 1, videoStopped: 1 });
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('button', { name: 'Saved locally' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download / export' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.webm$/);
  await page.getByRole('button', { name: 'Daily Practice' }).click();
  await expect(page.getByText('Recording saved')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await page.getByRole('button', { name: 'View recording' }).click();
  await expect(page.getByLabel('Recorded performance playback')).toBeVisible();
  await page.getByRole('button', { name: 'Delete recording' }).click();
  await expect(page.getByText('Recording saved')).toHaveCount(0);
});

test('permission denial and storage failure are visible; failed save preserves download', async ({ page }) => {
  await mockCapture(page);
  await page.goto('/');
  await page.evaluate(() => { (window as unknown as { captureTest: { deny: boolean } }).captureTest.deny = true; });
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await page.getByRole('button', { name: 'Record Performance' }).click();
  await expect(page.getByRole('alert')).toContainText('permission was denied');
  await page.evaluate(() => { (window as unknown as { captureTest: { deny: boolean } }).captureTest.deny = false; });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Front camera preview')).toBeVisible();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.getByRole('button', { name: 'Stop recording' }).click({ timeout: 5000 });
  await page.evaluate(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: () => { throw new Error('storage unavailable'); } } }); });
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save locally');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download / export' }).click();
  await download;
  await page.getByRole('button', { name: 'Daily Practice' }).click();
  await expect(page.getByText('This take is not saved')).toBeVisible();
});

test('cancel releases both tracks; recording from a scored lesson stops its microphone', async ({ page }) => {
  await mockCapture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await page.getByRole('button', { name: 'Record Performance' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { captureTest: { audioStopped: number; videoStopped: number } }).captureTest)).toMatchObject({ audioStopped: 1, videoStopped: 1 });
  await page.getByRole('button', { name: '← Home' }).click();
  await page.getByRole('button', { name: /Open Strings/ }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop Listening' })).toBeVisible();
  await page.getByRole('button', { name: 'Record Performance' }).click();
  await expect(page.getByLabel('Front camera preview')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { captureTest: { scoredStopped: number; requests: number } }).captureTest)).toMatchObject({ scoredStopped: 1, requests: 3 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Open Strings' })).toBeVisible();
});

test('score and recording controls fit a phone in landscape', async ({ page }) => {
  await mockCapture(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await startRecording(page);
  await expect(page.locator('.staff svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Stop recording' }).click();
});
