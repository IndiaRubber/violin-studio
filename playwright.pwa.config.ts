import { defineConfig } from '@playwright/test';

// Edge on Windows by default; set PW_CHANNEL=chrome to run with an installed Chrome elsewhere.
const channel = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './e2e/pwa',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', channel, serviceWorkers: 'allow' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: true },
});
