import { defineConfig, devices } from '@playwright/test';

// Browsers come from the flake (PLAYWRIGHT_BROWSERS_PATH points into the nix
// store), never from playwright's downloader. The suite stays at smoke depth
// until M4 grows it (#38).
export default defineConfig({
  testDir: './src',
  outputDir: './test-output/playwright/output',
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: './test-output/playwright/report', open: 'never' },
    ],
  ],
  forbidOnly: !!process.env['CI'],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec nx run @panoptes/studio:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
