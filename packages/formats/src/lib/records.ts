/**
 * Whether a value is a plain keyed object: the walks over a parsed document
 * treat an array as a sequence rather than as a record, so an array is not
 * one.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
