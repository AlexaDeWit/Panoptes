import { isRecord } from './records.js';

/**
 * Whether two values a codec read out of a document, or is about to write
 * into one, say the same thing: the same primitives, the same array order,
 * and the same own keys throughout. A write asks this to decide whether a
 * value the source already carries still reads back as the model's, since
 * rewriting one that does would report a user's edit where there was none.
 *
 * Membership is `Object.hasOwn`, so a key named after a prototype member
 * (`__proto__`, `toString`) is compared like any other rather than matching
 * one the other side does not carry.
 */
export function equivalent(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => equivalent(entry, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && equivalent(left[key], right[key]),
      )
    );
  }
  return left === right;
}
