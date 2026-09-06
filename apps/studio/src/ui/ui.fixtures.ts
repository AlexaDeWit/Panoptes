/**
 * How long the category field's suite is given, past the root
 * `vitest.shared.mts` sets. Its tests open a Radix select in jsdom through
 * `userEvent`, which pays for a synthetic key sequence, Radix's own focus and
 * typeahead work, and an accessibility-tree query over the open listbox,
 * rather than for the options themselves: the three-option field measured
 * 4.1 s in the same runs against this one's 5.0 s. The ten-run loop that set
 * the root measured a studio field spec at 9.0 s against it, which three runs
 * at 5.3 s worst are too small a sample to retire.
 */
export const listboxTimeout = 30_000;
