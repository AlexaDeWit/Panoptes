import {
  ciaCategorySchema,
  ciaDieCategorySchema,
  linddunCategorySchema,
  plot4aiCategorySchema,
  strideCategorySchema,
  threatCategorySchema,
  type ThreatCategory,
} from '@panoptes/model';

import { EnumField } from './enum-field.js';

const enumerated: readonly {
  readonly methodology: string;
  readonly categories: readonly string[];
}[] = [
  {
    methodology: strideCategorySchema.shape.methodology.value,
    categories: strideCategorySchema.shape.category.options,
  },
  {
    methodology: linddunCategorySchema.shape.methodology.value,
    categories: linddunCategorySchema.shape.category.options,
  },
  {
    methodology: ciaCategorySchema.shape.methodology.value,
    categories: ciaCategorySchema.shape.category.options,
  },
  {
    methodology: ciaDieCategorySchema.shape.methodology.value,
    categories: ciaDieCategorySchema.shape.category.options,
  },
  {
    methodology: plot4aiCategorySchema.shape.methodology.value,
    categories: plot4aiCategorySchema.shape.category.options,
  },
];

function methodologyOf(key: string): string {
  return key.split(' ')[0];
}

function categoryFromKey(key: string): ThreatCategory | undefined {
  const [methodology, ...rest] = key.split(' ');
  const parsed = threatCategorySchema.safeParse({
    methodology,
    category: rest.join(' '),
  });
  return parsed.success ? parsed.data : undefined;
}

/**
 * A category as the one string a listbox can carry: the methodology, a space,
 * and the category it names. A custom category keeps the word the union files
 * it under in front, which no enumerated methodology is named, so its key
 * cannot collide with an enumerated pair however the methodology was named.
 */
export function categoryKey(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? `custom ${category.methodologyName} ${category.category}`
    : `${category.methodology} ${category.category}`;
}

/**
 * Every methodology and category the model enumerates, paired, in the order
 * the union declares them. The custom variant contributes none: its
 * methodology name is free text, so it stands for no fixed set of pairs.
 */
export const enumeratedCategoryKeys: readonly string[] = enumerated.flatMap(
  ({ methodology, categories }) =>
    categories.map((category) => `${methodology} ${category}`),
);

/**
 * The listbox's value handler, bound to one `onCommit`. The category schema
 * is the only authority on which pairs are categories, so a chosen key
 * becomes a category here or commits nothing. A custom category's own key
 * takes the second path: it is offered so the field can show the category a
 * file carried, and choosing it again leaves the threat as it is.
 */
export function categoryCommitter(
  onCommit: (category: ThreatCategory) => void,
): (chosen: string) => void {
  return (chosen) => {
    const category = categoryFromKey(chosen);
    if (category !== undefined) {
      onCommit(category);
    }
  };
}

/** What a {@link CategoryField} shows and where an edit goes. */
export type CategoryFieldProps = {
  readonly value: ThreatCategory;
  readonly onCommit: (category: ThreatCategory) => void;
};

/**
 * What the threat is a case of, as a listbox over every methodology the model
 * enumerates at once. One choice settles both halves of the category, so a
 * methodology never stands over a category that does not belong to it.
 *
 * The options are grouped under the methodology they belong to, thirty pairs
 * being more than a person scans as one list.
 *
 * A threat that arrived carrying a custom category shows it, as an option of
 * its own, and can be moved onto an enumerated pair. Naming a new custom
 * methodology is not offered here: it is two free-text fields and a decision
 * about which methodology the model is being read under, which the panel's
 * README records as deferred.
 */
export function CategoryField({ value, onCommit }: CategoryFieldProps) {
  const key = categoryKey(value);
  const options = enumeratedCategoryKeys.includes(key)
    ? enumeratedCategoryKeys
    : [key, ...enumeratedCategoryKeys];

  return (
    <EnumField
      groupOf={methodologyOf}
      label="Category"
      onCommit={categoryCommitter(onCommit)}
      options={options}
      value={key}
    />
  );
}
