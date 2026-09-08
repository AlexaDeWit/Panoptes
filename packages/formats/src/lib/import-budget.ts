import { exceededReadLimit, readLimits } from './read-limits.js';
import type { ReadFailure } from './codec.js';

/** Bounds cumulative imported text before concatenation or identifier escaping. */
export function importBudget() {
  let remaining = readLimits.maxImportTextUnits;
  let failure: ReadFailure | undefined;
  const reserve = (units: number): boolean => {
    if (failure !== undefined) return false;
    if (units > remaining) {
      failure = exceededReadLimit(
        'maxImportTextUnits',
        readLimits.maxImportTextUnits - remaining + units,
      );
      return false;
    }
    remaining -= units;
    return true;
  };
  return {
    reserve,
    get failure() {
      return failure;
    },
    text: (parts: readonly string[], separator = '\n\n'): string => {
      if (failure !== undefined) return '';
      const present = parts.filter(Boolean);
      const units =
        present.reduce((total, part) => total + part.length, 0) +
        Math.max(0, present.length - 1) * separator.length;
      return reserve(units) ? present.join(separator) : '';
    },
    id: (kind: string, ...parts: readonly string[]): string => {
      const units =
        kind.length +
        3 +
        parts.reduce((total, part) => total + 3 + part.length * 6, 0);
      return reserve(units) ? `${kind}:${JSON.stringify(parts)}` : '';
    },
  };
}
