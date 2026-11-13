import { defineConfig } from '@playwright/test';

// Edge on Windows by default; set PW_CHANNEL=chrome to run with an installed Chrome elsewhere.
const channel = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/pwa/**',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', channel },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
