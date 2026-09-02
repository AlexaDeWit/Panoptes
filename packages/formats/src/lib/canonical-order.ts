import { isRecord } from './records.js';

type SchemaDef = {
  readonly type: string;
  readonly shape?: Readonly<Record<string, Schema>>;
  readonly options?: readonly Schema[];
  readonly discriminator?: string;
  readonly element?: Schema;
  readonly values?: readonly unknown[];
};

type Schema = { readonly def: SchemaDef };

type Shape = Readonly<Record<string, Schema>>;

/**
 * A value rebuilt with its keys in the order its schema declares them, and
 * the discriminator of a tagged variant first whatever position the schema
 * gives it.
 *
 * A serializer writes an object's keys in insertion order, so a projection
 * that hands a record straight to one inherits the order whoever built that
 * record chose. This replaces it with the schema's, which is what makes two
 * writes of one model byte-identical. The discriminator leads because a
 * variant is unreadable until you know which variant it is, and composing a
 * shape by extension puts the tag last.
 *
 * The walk descends through objects, arrays, and discriminated unions, and
 * returns anything else as it stands. Its depth is the schema's rather than
 * the value's, so a value carrying a cycle, which a YAML alias can build,
 * cannot drive it deeper than the schema goes. What comes back carries the
 * schema's key set: a key the schema declares and the value does not have is
 * left out, and a key the value has and the schema does not declare is
 * dropped.
 */
export function canonicalOrder(schema: Schema, value: unknown): unknown {
  const { shape, element, options, discriminator } = schema.def;
  if (shape !== undefined) {
    return orderedFields(shape, value);
  }
  if (element !== undefined) {
    return Array.isArray(value)
      ? value.map((item: unknown) => canonicalOrder(element, item))
      : value;
  }
  if (options !== undefined && discriminator !== undefined) {
    return orderedVariant(options, discriminator, value);
  }
  return value;
}

function orderedVariant(
  options: readonly Schema[],
  discriminator: string,
  value: unknown,
): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const shape = variantShape(options, discriminator, value[discriminator]);
  return shape === undefined
    ? value
    : orderedFields(shape, value, discriminator);
}

function variantShape(
  options: readonly Schema[],
  discriminator: string,
  tag: unknown,
): Shape | undefined {
  for (const option of options) {
    const shape = option.def.shape;
    if (shape?.[discriminator]?.def.values?.includes(tag) === true) {
      return shape;
    }
  }
  return undefined;
}

function orderedFields(
  shape: Shape,
  value: unknown,
  leading?: string,
): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const ordered: Record<string, unknown> = {};
  for (const [key, field] of leadingFirst(shape, leading)) {
    if (Object.hasOwn(value, key)) {
      ordered[key] = canonicalOrder(field, value[key]);
    }
  }
  return ordered;
}

function leadingFirst(
  shape: Shape,
  leading: string | undefined,
): [string, Schema][] {
  const fields = Object.entries(shape);
  return leading === undefined
    ? fields
    : [
        ...fields.filter(([key]) => key === leading),
        ...fields.filter(([key]) => key !== leading),
      ];
}
