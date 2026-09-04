import { defineConfig, devices } from '@playwright/test';

// Browsers come from the flake (PLAYWRIGHT_BROWSERS_PATH points into the nix
// store), never from playwright's downloader. The suite covers the boot smoke
// and the axe-core accessibility check, which is the half of the studio's
// accessibility gate that needs a real browser; #38 grows it further.
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
