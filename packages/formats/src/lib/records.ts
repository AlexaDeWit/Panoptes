/**
 * Whether a value is a plain keyed object: the walks over a parsed document
 * treat an array as a sequence rather than as a record, so an array is not
 * one.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a value holds other values under keys, an array's indices counted
 * among them. The bound on how deeply a document nests is about how far a
 * walk descends rather than about which kind of collection each step is, so
 * `Object.values` serves both and this is the test in front of it.
 */
export function isKeyed(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
