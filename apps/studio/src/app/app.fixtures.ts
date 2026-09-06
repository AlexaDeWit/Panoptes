/**
 * How long the app's suite is given, past the root `vitest.shared.mts` sets.
 * Every test mounts the whole studio into jsdom, the React Flow canvas, the
 * threat panel and the menu at once, and the slowest drives the palette and
 * the menu through `userEvent` on top of that. Three runs on a host at load
 * average 37 to 55 put the worst at 6.7 s and a bare render at 5.9 s, which
 * on a sample of three is too near the 10 s root to leave at it.
 */
export const appTimeout = 30_000;
