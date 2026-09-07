import { defineConfig, devices } from '@playwright/test';

const frameTimeFloor = /drag-frame-time\.spec\.ts$/u;
const pagesExport = /pages-export\.spec\.ts$/u;
const pagesBasePath = '/Saerskriven';
const pagesPort = 4300;

// Browsers come from the flake (PLAYWRIGHT_BROWSERS_PATH points into the nix
// store), never from playwright's downloader. What the suite covers, why each
// spec needs a browser at all, and which line of M4's definition of done each
// one holds are in README.md beside this file.
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
  webServer: [
    {
      command: 'pnpm exec nx run @saerskriven/studio:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: `pnpm exec nx run @saerskriven/studio:preview -- --port=${String(pagesPort)}`,
      env: { PAGES_BASE_PATH: pagesBasePath },
      url: `http://localhost:${String(pagesPort)}${pagesBasePath}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [frameTimeFloor, pagesExport],
    },
    {
      name: 'pages',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${String(pagesPort)}${pagesBasePath}/`,
      },
      testMatch: pagesExport,
      dependencies: ['chromium'],
      workers: 1,
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
      dependencies: ['pages'],
      workers: 1,
      fullyParallel: false,
      retries: 1,
    },
  ],
});
