import { expect, test } from '@playwright/test';

test('catalog @playwright/test matches the nixpkgs playwright-driver', () => {
  const driverVersion = process.env['PLAYWRIGHT_DRIVER_VERSION'];
  expect(
    driverVersion,
    'PLAYWRIGHT_DRIVER_VERSION is unset: run inside the flake shell',
  ).toBeDefined();
  expect(test.info().config.version).toBe(driverVersion);
});
