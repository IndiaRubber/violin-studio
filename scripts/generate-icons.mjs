import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(resolve(root, 'public/icons/icon.svg'), 'utf8');
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', '<svg style="width:100vw;height:100vh" ')}</body></html>`);
    await page.screenshot({ path: resolve(root, `public/icons/icon-${size}.png`), animations: 'disabled' });
    await page.close();
  }
  const maskable = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await maskable.setContent(`<html><body style="margin:0">${svg.replace('rx="92"', 'rx="0"').replace('<svg ', '<svg style="width:100vw;height:100vh" ')}</body></html>`);
  await maskable.screenshot({ path: resolve(root, 'public/icons/icon-maskable-512.png'), animations: 'disabled' });
  await maskable.close();
} finally { await browser.close(); }
