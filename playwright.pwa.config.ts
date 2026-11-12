import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/pwa',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', channel: 'msedge', serviceWorkers: 'allow' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: true },
});
