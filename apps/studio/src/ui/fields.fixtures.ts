/**
 * How long a field spec that opens its listbox is given, past the root
 * `vitest.shared.mts` sets. Such a test renders a Radix select into jsdom and
 * drives it through `userEvent`, so it pays for a synthetic key sequence,
 * Radix's own focus and typeahead work, and an accessibility-tree query over
 * every option the listbox opened with. The ten-run loop that set the root
 * measured a studio field spec at 9.0 s against it, and three runs of this
 * suite on a host at load average 37 to 55 put its worst at 5.3 s. How many
 * options a listbox holds is not what costs: the three-option field measured
 * 4.1 s in those same runs against the thirty-option one's 5.0 s, so offering
 * a spec fewer values would buy no time and would drop the count of pairs it
 * pins.
 */
export const listboxTimeout = 30_000;
