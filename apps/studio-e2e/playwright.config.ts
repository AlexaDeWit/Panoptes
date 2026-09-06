import { defineConfig, devices } from '@playwright/test';

const frameTimeFloor = /drag-frame-time\.spec\.ts$/u;

// Browsers come from the flake (PLAYWRIGHT_BROWSERS_PATH points into the nix
// store), never from playwright's downloader. The suite covers the boot smoke,
// the axe-core accessibility check, which is the half of the studio's
// accessibility gate that needs a real browser, opening and saving a file,
// which needs a browser for the file input and the download, and the canvas
// gestures, which need one to drag, focus and move an element, and the frame
// time floor a drag of Écluse holds to (issue #181).
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: frameTimeFloor,
    },
    // The floor reads what the machine gives the page, and that reading moved
    // by a factor of ten between two and four workers, so it is comparable
    // only at a worker count the config fixes rather than the host's core
    // count. One worker here, and the rest of the suite keeps its own
    // parallelism. The reading is comparable only where no other browser
    // shares the host, so this project depends on the other and runs alone
    // once the others are done rather than beside them. Playwright skips a
    // project whose dependency failed, so a red anywhere else in the smoke
    // leaves the floor unreported rather than reported green.
    {
      name: 'frame-time',
      use: { ...devices['Desktop Chrome'] },
      testMatch: frameTimeFloor,
      dependencies: ['chromium'],
      workers: 1,
      fullyParallel: false,
    },
  ],
});
