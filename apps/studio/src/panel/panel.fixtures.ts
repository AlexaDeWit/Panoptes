import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * How long a spec that drives the threat editor is given, past the root
 * `vitest.shared.mts` sets. The editor's own suite renders three text fields,
 * three Radix listboxes and the accordion around them into jsdom, and the
 * panel's suite renders the panel around all of that; both drive it through
 * `userEvent`, which commits and rerenders at every step. Three runs on a
 * host at load average 37 to 55 put the worst at 9.1 s against the 10 s root,
 * and which test tops out moves between runs, so the bound is the suite's
 * rather than one test's.
 */
export const editorTimeout = 30_000;

/** Chooses a labelled option through the shared listbox control. */
export const chooseFrom = async (
  field: string,
  option: string,
): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(screen.getByRole('option', { name: option }));
};
