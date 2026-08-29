import { expect, test } from '@playwright/test';

// Each side comes from its authoritative home: the flake exports the nixpkgs
// playwright-driver version into the shell, and the running test reports the
// installed @playwright/test version. A driver of one version cannot run
// browsers installed for another, so an unpaired bump must fail here, with
// the cause named, before any browser-dependent spec fails without it.
test('catalog @playwright/test matches the nixpkgs playwright-driver', () => {
  const driverVersion = process.env['PLAYWRIGHT_DRIVER_VERSION'];
  expect(
    driverVersion,
    'PLAYWRIGHT_DRIVER_VERSION is unset: run inside the flake shell',
  ).toBeDefined();
  expect(test.info().config.version).toBe(driverVersion);
});
