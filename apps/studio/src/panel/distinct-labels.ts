/** One choice a listbox offers: its id, what it is called, and whether that name is a stand-in. */
export type LabelledChoice = {
  readonly id: string;
  readonly label: string;
  readonly unnamed: boolean;
};

/**
 * Option labels a person can tell apart. A stand-in name or a repeated name
 * carries its id, and where labels still collide after normalization every
 * one takes a numbered prefix.
 */
export function distinctLabels(
  choices: readonly LabelledChoice[],
): ReadonlyMap<string, string> {
  const counts = new Map<string, number>();
  for (const { label } of choices) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const labels = choices.map(({ id, label, unnamed }) =>
    unnamed || (counts.get(label) ?? 0) > 1 ? `${label} (${id})` : label,
  );
  const distinct =
    new Set(
      labels.map((label) =>
        label.normalize('NFC').replace(/\s+/gu, ' ').trim(),
      ),
    ).size === choices.length;
  return new Map(
    choices.map(({ id }, index) => [
      id,
      distinct ? labels[index] : `${String(index + 1)}: ${labels[index]}`,
    ]),
  );
}
