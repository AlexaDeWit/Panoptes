/**
 * Records under their own ids, so a comparison follows identity rather than
 * position: inserting one record into a list would otherwise read as a
 * change to every record after it. One id is one entry, so a list holding
 * the same id twice comes back shorter than it went in.
 */
export const identified = (
  records: readonly { readonly id: string }[],
): Record<string, unknown> =>
  Object.fromEntries(records.map((record) => [record.id, record]));

const missing: unique symbol = Symbol('missing');

const isKeyed = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entryOf = (holder: Record<string, unknown>, key: string): unknown =>
  key in holder ? holder[key] : missing;

const itemOf = (holder: readonly unknown[], index: number): unknown =>
  index < holder.length ? holder[index] : missing;

const keysOf = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): readonly string[] => [
  ...Object.keys(before),
  ...Object.keys(after).filter((key) => !(key in before)),
];

const under = (
  before: unknown,
  after: unknown,
  path: string,
  found: string[],
): void => {
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      under(
        itemOf(before, index),
        itemOf(after, index),
        `${path}[${index}]`,
        found,
      );
    }
    return;
  }
  if (isKeyed(before) && isKeyed(after)) {
    for (const key of keysOf(before, after)) {
      under(
        entryOf(before, key),
        entryOf(after, key),
        path === '' ? key : `${path}.${key}`,
        found,
      );
    }
    return;
  }
  if (!Object.is(before, after)) {
    found.push(path);
  }
};

/**
 * Every path at which two parsed values differ, in the order the first
 * declares its keys. A record one side holds and the other does not is
 * reported at its own path rather than walked, so a whole added element is
 * one entry rather than one per field, and a path that is not listed names a
 * value both sides hold identically. Arrays are compared by position, so a
 * reordered list differs at every position that moved, which is what
 * {@link identified} is for. Objects are compared by key name, so this is a
 * structural comparison and no claim about the bytes either side was parsed
 * from: an indent or a key order is invisible to it.
 */
export const differingPaths = (
  before: unknown,
  after: unknown,
): readonly string[] => {
  const found: string[] = [];
  under(before, after, '', found);
  return found;
};
