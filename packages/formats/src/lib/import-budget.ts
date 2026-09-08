import { exceededReadLimit, readLimits } from './read-limits.js';
import type { ReadFailure } from './codec.js';

/** Bounds text before allocation. Identifier characters also fit the canvas selectors. */
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
        String(parts.length).length +
        2 +
        Math.max(0, parts.length - 1) +
        parts.reduce((total, part) => total + part.length * 6, 0);
      if (!reserve(units)) return '';
      const encoded = parts.map((part) =>
        part.replace(
          /[^A-Za-z0-9]/g,
          (unit) => `_${unit.charCodeAt(0).toString(16)}_`,
        ),
      );
      return `${kind}-${String(parts.length)}-${encoded.join('-')}`;
    },
  };
}
