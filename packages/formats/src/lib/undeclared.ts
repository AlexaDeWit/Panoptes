import type { Divergence } from './divergence.js';

const escapableSegment = /[\\.]/g;

/**
 * The keys a wire schema did not declare and so did not keep, as
 * `undeclared` divergences, one per key in the order the document holds
 * them. `given` is the document as the format's own parser produced it and
 * `kept` is what the wire schema returned for it.
 *
 * The walk descends only where both sides carry structure, so its depth is
 * the schema's and not the file's: it runs on a document the schema
 * accepted, and a value the schema does not describe is reported rather
 * than descended into. Membership is `Object.hasOwn`, so a key named after
 * a prototype member (`__proto__`, `toString`) is reported like any other
 * rather than mistaken for a declared one. A dot or a backslash inside a
 * key is escaped, so a key carrying one cannot render as a path through
 * two.
 */
export function undeclaredDivergences(
  given: unknown,
  kept: unknown,
): readonly Divergence[] {
  return undeclaredKeys(given, kept, []).map((key): Divergence => ({
    subject: { kind: 'model' },
    detail: `the key ${key}`,
    reason: 'undeclared',
  }));
}

function undeclaredKeys(
  given: unknown,
  kept: unknown,
  path: readonly string[],
): string[] {
  if (Array.isArray(given) && Array.isArray(kept)) {
    return given.flatMap((entry, index) =>
      undeclaredKeys(entry, kept[index], [...path, String(index)]),
    );
  }
  if (isRecord(given) && isRecord(kept)) {
    return Object.keys(given).flatMap((key) =>
      Object.hasOwn(kept, key)
        ? undeclaredKeys(given[key], kept[key], [...path, key])
        : [joinPath([...path, key])],
    );
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinPath(path: readonly string[]): string {
  return path
    .map((segment) => segment.replace(escapableSegment, '\\$&'))
    .join('.');
}
