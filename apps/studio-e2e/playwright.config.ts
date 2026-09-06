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
    // The floor reads what the machine gives the page, so it is comparable
    // only where no other browser shares the host: copies of this spec run at
    // the same time all fail, where the same spec alone reads not one frame
    // late. How far over they read is the host's, not this project's, so no
    // figure is quoted here. Hence one worker, and a dependency on the
    // project carrying the rest of the suite, so this one runs alone once the
    // others are done rather than beside them, while they keep their own
    // parallelism. Playwright skips a project whose dependency failed, so a
    // red anywhere else in the smoke leaves the floor unreported rather than
    // reported green. A burst of activity elsewhere on the host can still
    // land inside the drag, so a single noisy run is retried once and a
    // second failure is the reading; the ceilings themselves do not move.
    {
      name: 'frame-time',
      use: { ...devices['Desktop Chrome'] },
      testMatch: frameTimeFloor,
      dependencies: ['chromium'],
      workers: 1,
      fullyParallel: false,
      retries: 1,
    },
  ],
});
