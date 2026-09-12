import { defineConfig, devices } from '@playwright/test';

const frameTimeFloor = /drag-frame-time\.spec\.ts$/u;
const pagesExport = /pages-export\.spec\.ts$/u;
const phoneSmoke = /(?:chrome-card|notices)\.spec\.ts$/u;
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
      command: 'bash scripts/preview-studio-pages.sh',
      cwd: '../..',
      env: {
        PAGES_BASE_PATH: pagesBasePath,
        PAGES_PREVIEW_PORT: String(pagesPort),
      },
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
    // A phone viewport is the one the shell chrome has least room in, so the
    // card spec and the notice spec run here as well as under `chromium`,
    // which is what holds the ruling that the layout is the same at every
    // width and that a dismissed refusal leaves the chrome clear. The preset
    // carries the viewport, the touch flags and the device pixel ratio
    // together, so a change of preset changes all three at once. The set is
    // small on purpose: the rest of the suite is about behaviour that does
    // not turn on the viewport.
    {
      name: 'phone',
      use: { ...devices['Pixel 7'] },
      testMatch: phoneSmoke,
      dependencies: ['chromium'],
    },
    {
      name: 'pages',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${String(pagesPort)}${pagesBasePath}/`,
      },
      testMatch: pagesExport,
      dependencies: ['phone'],
      workers: 1,
    },
    // The floor reads what the machine gives the page, so it is comparable
    // only where no other browser shares the host: copies of this spec run at
    // the same time all fail, where the same spec alone reads not one frame
    // late. Hence one worker, and a dependency on the project carrying the
    // rest of the suite, so this one runs alone once the others are done
    // rather than beside them, while they keep their own parallelism.
    // Playwright skips a project whose dependency failed, so a red anywhere
    // else in the smoke leaves the floor unreported rather than reported
    // green. A burst of activity elsewhere on the host can still land inside
    // the drag, so a single noisy run is retried once and a second failure is
    // the reading. The retry records no trace: tracing paces the drag with
    // screenshots and snapshots, and a retry under more load than the first
    // attempt is no second reading. Both ceilings in the spec are regression
    // signals. The share ceiling does not move. The single-longest-frame
    // ceiling sits above the band a GitHub-hosted runner produces on its own
    // (#309) and moves only with a new reading of that band.
    {
      name: 'frame-time',
      use: { ...devices['Desktop Chrome'], trace: 'off' },
      testMatch: frameTimeFloor,
      dependencies: ['pages'],
      workers: 1,
      fullyParallel: false,
      retries: 1,
    },
  ],
});
