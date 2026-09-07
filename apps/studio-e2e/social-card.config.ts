import { defineConfig, devices } from '@playwright/test';

const port = 4400;

export default defineConfig({
  testDir: './src',
  testMatch: /social-card\.spec\.ts$/u,
  outputDir: './test-output/social-card',
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${String(port)}`,
  },
  webServer: {
    command: `pnpm exec vite --config apps/studio/vite.config.mts --port ${String(port)} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${String(port)}/social-card-source.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
