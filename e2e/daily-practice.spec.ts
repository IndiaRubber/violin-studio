import { expect, test, type Page } from '@playwright/test';

async function syntheticMic(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
      gain.gain.value = 0; oscillator.connect(gain).connect(output); oscillator.start(); await context.resume();
      Object.assign(window, { historyMic: { set: (hz: number) => { oscillator.frequency.value = hz; gain.gain.value = 1; } } });
      return output.stream;
    } } });
  });
}

test('warmup check persists with a timestamp, can be undone, and older days remain browsable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  const bowing = page.getByRole('checkbox', { name: /Right-hand bowing/ });
  await bowing.check();
  await expect(bowing).toBeChecked();
  await expect(page.getByText('Warmup completed')).toBeVisible();
  const entries = await page.evaluate(async () => new Promise<{ id: string; completedAt: string }[]>((resolve, reject) => {
    const request = indexedDB.open('violin-studio-practice-data');
    request.onsuccess = () => { const db = request.result, tx = db.transaction('events'); const get = tx.objectStore('events').getAll(); get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); };
    request.onerror = () => reject(request.error);
  }));
  expect(entries).toHaveLength(1);
  expect(new Date(entries[0].completedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  await page.reload();
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await expect(bowing).toBeChecked();
  await bowing.uncheck();
  await expect(bowing).not.toBeChecked();
  await expect(page.getByText('Warmup completed')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Practice history' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('lesson completion saves once per visit and preserves two separate completions', async ({ page }) => {
  await syntheticMic(page);
  await page.goto('/');
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByRole('button', { name: /Open Strings/ }).click();
    await page.getByRole('button', { name: 'Quick check' }).click();
    await page.getByRole('button', { name: 'Start Listening' }).click();
    for (const [index, hz] of [196, 293.6648, 440, 659.2551].entries()) {
      await page.evaluate(frequency => (window as unknown as { historyMic: { set: (hz: number) => void } }).historyMic.set(frequency), hz);
      if (index < 3) await expect(page.getByText(`Note ${index + 2} of 4`)).toBeVisible({ timeout: 5000 });
    }
    await expect(page.getByText('Saved in local practice history.')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Back to exercises' }).click();
    await page.getByRole('button', { name: /Today’s Practice/ }).click();
    await expect(page.getByText('Lesson completed')).toHaveCount(attempt);
    await page.getByRole('button', { name: '← Home' }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await expect(page.getByText('Lesson completed')).toHaveCount(2);
});

test('storage failure keeps an attempted warmup unchecked and reports the problem', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: () => { throw new Error('storage denied'); } } }); });
  await page.goto('/');
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await expect(page.getByRole('alert')).toContainText('Practice history could not be opened');
  const bowing = page.getByRole('checkbox', { name: /Right-hand bowing/ });
  await bowing.click();
  await expect(bowing).not.toBeChecked();
  await expect(page.getByRole('alert')).toContainText('Could not save that change locally');
});

test('history groups an earlier local day without a date picker or typing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('violin-studio-practice-data', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('events', { keyPath: 'id' });
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('events', 'readwrite');
        tx.objectStore('events').put({ id: 'yesterday', type: 'warmup', title: 'Posture and relaxation', activityId: 'posture', completedAt: yesterday.toISOString() });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  await page.getByRole('button', { name: /Today’s Practice/ }).click();
  await expect(page.locator('.history-day')).toHaveCount(1);
  await expect(page.locator('.history-day h3')).not.toHaveText('Today');
  await expect(page.locator('.history-day').getByText('Posture and relaxation')).toBeVisible();
  await expect(page.locator('.history-day time')).toBeVisible();
});
