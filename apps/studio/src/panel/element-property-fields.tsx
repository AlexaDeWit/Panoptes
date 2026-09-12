import type { Element, ElementId } from '@saerskriven/model';
import { useRef, useState } from 'react';
import { EnumField } from '../ui/enum-field.js';
import { TextField, type RefusedDraft } from '../ui/text-field.js';
import styles from './element-properties.module.css';
import { elementLabel } from './threats.js';

const flags = ['Not recorded', 'Yes', 'No'] as const;
const recording = ['Not recorded', 'Recorded'] as const;

type Field<Value> = {
  readonly label: string;
  readonly value: Value;
  readonly onCommit: (value: Value) => void;
};

/** A security flag with unknown distinct from an explicit negative. */
export function BooleanProperty({
  label,
  value,
  onCommit,
}: Field<boolean | undefined>) {
  return (
    <EnumField
      label={label}
      value={value === undefined ? 'Not recorded' : value ? 'Yes' : 'No'}
      options={flags}
      onCommit={(choice) => {
        onCommit(choice === 'Not recorded' ? undefined : choice === 'Yes');
      }}
    />
  );
}

/** An optional text fact retains explicit empty text and reports invalid drafts. */
export function TextProperty({
  label,
  value,
  onCommit,
  held,
  onRefused,
}: Field<string | undefined> & {
  readonly held?: string;
  readonly onRefused: (draft: RefusedDraft | undefined) => void;
}) {
  return (
    <div className={styles.group}>
      <EnumField
        label={`${label} recording`}
        value={value === undefined ? 'Not recorded' : 'Recorded'}
        options={recording}
        onCommit={(choice) => {
          onRefused(undefined);
          onCommit(choice === 'Not recorded' ? undefined : (value ?? ''));
        }}
      />
      {value !== undefined && (
        <TextField
          label={label}
          value={value}
          held={held}
          onCommit={onCommit}
          onRefused={onRefused}
        />
      )}
    </div>
  );
}

/** Edits ordered relationship assertions using only valid targets, retaining duplicates until explicitly removed. */
export function RelationshipProperty({
  label,
  value,
  choices,
  onCommit,
}: Field<ElementId[] | undefined> & {
  readonly choices: readonly Element[];
}) {
  const group = useRef<HTMLFieldSetElement>(null);
  const [chosen, setChosen] = useState<ElementId | undefined>();
  const options = choices.map((element) => element.id);
  const addition =
    chosen !== undefined && options.includes(chosen) ? chosen : options[0];
  const names = choices.map(elementLabel);
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const labels = choices.map((element, index) =>
    element.name === '' || (counts.get(names[index]) ?? 0) > 1
      ? `${names[index]} (${element.id})`
      : names[index],
  );
  const distinct =
    new Set(
      labels.map((name) => name.normalize('NFC').replace(/\s+/gu, ' ').trim()),
    ).size === choices.length;
  const labelled = new Map(
    choices.map((element, index) => [
      element.id,
      distinct ? labels[index] : `${String(index + 1)}: ${labels[index]}`,
    ]),
  );
  const labelOf = (id: ElementId) => labelled.get(id) ?? id;

  return (
    <fieldset className={styles.relationship} ref={group}>
      <legend>{label}</legend>
      <EnumField
        label={`${label} recording`}
        value={value === undefined ? 'Not recorded' : 'Recorded'}
        options={recording}
        onCommit={(choice) => {
          onCommit(choice === 'Not recorded' ? undefined : (value ?? []));
        }}
      />
      {value !== undefined && (
        <>
          {value.length === 0 && (
            <p className={styles.hint}>No relationships.</p>
          )}
          {value.map((id, index) => (
            <div className={styles.relationshipRow} key={index}>
              <EnumField
                label={`${label} ${String(index + 1)}`}
                value={id}
                options={options}
                labelOf={labelOf}
                onCommit={(replacement) => {
                  onCommit(
                    value.map((held, at) =>
                      at === index ? replacement : held,
                    ),
                  );
                }}
              />
              <button
                type="button"
                data-remove-relationship
                aria-label={`Remove ${label.toLowerCase()} ${String(index + 1)}`}
                onClick={() => {
                  onCommit(value.filter((_, at) => at !== index));
                  requestAnimationFrame(() => {
                    const buttons =
                      group.current?.querySelectorAll<HTMLButtonElement>(
                        '[data-remove-relationship]',
                      );
                    const target =
                      buttons?.[index] ??
                      buttons?.[index - 1] ??
                      group.current?.querySelector<HTMLButtonElement>(
                        '[data-add-relationship]',
                      );
                    target?.focus();
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {addition === undefined ? (
            <p className={styles.hint}>No valid targets in this diagram.</p>
          ) : (
            <div className={styles.relationshipRow}>
              <EnumField
                label={`Add to ${label.toLowerCase()}`}
                value={addition}
                options={options}
                labelOf={labelOf}
                onCommit={setChosen}
              />
              <button
                type="button"
                data-add-relationship
                onClick={() => {
                  onCommit([...value, addition]);
                }}
              >
                Add relationship
              </button>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
