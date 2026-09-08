import type { ElementId } from '@saerskriven/model';

/** Compares selection membership and order. */
export function sameSelection(
  before: readonly ElementId[],
  after: readonly ElementId[],
): boolean {
  return (
    before.length === after.length &&
    before.every((id, index) => id === after[index])
  );
}
