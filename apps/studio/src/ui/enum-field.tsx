import { useId } from 'react';
import { Select } from 'radix-ui';

import styles from './enum-field.module.css';

/**
 * The listbox's value handler, bound to one `onCommit`. Radix reports a choice
 * as a plain string and `options` is the only authority on which strings the
 * field offers, so this is where one becomes the other. The arm that drops a
 * value no option names is unreachable from the markup below, whose items are
 * generated from that same list, which is why the handler sits beside the
 * component: an unreachable arm is held by nothing unless a spec can call it
 * directly.
 */
export function enumCommitter<Value extends string>(
  options: readonly Value[],
  onCommit: (chosen: Value) => void,
): (chosen: string) => void {
  return (chosen) => {
    const named = options.find((option) => option === chosen);
    if (named !== undefined) {
      onCommit(named);
    }
  };
}

function listed(named: string) {
  return (
    <Select.Item className={styles.item} key={named} value={named}>
      <Select.ItemText>{named}</Select.ItemText>
      <Select.ItemIndicator className={styles.indicator}>
        ✓
      </Select.ItemIndicator>
    </Select.Item>
  );
}

function grouped<Value extends string>(
  options: readonly Value[],
  groupOf: (option: Value) => string,
): (readonly [string, readonly Value[]])[] {
  const groups = new Map<string, Value[]>();
  for (const option of options) {
    const name = groupOf(option);
    groups.set(name, [...(groups.get(name) ?? []), option]);
  }
  return [...groups];
}

/** What an {@link EnumField} shows, what it offers, and where an edit goes. */
export type EnumFieldProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly Value[];
  readonly groupOf?: (option: Value) => string;
  readonly onCommit: (chosen: Value) => void;
};

/**
 * One value out of a bounded set, as a listbox. Every call site takes its
 * options from a model schema, so the field offers what the model names and
 * nothing else, and `onCommit` is the single integration point: it fires once
 * per chosen value, already narrowed to that set, so the caller has one place
 * to dispatch a store action from. `groupOf` names the heading each option
 * sits under, for a set too long to scan flat; without it the options are one
 * list, which is what a set of five is.
 *
 * The open listbox stays inside this field rather than going to the document
 * body, so it sits in whichever landmark the panel around it declares.
 */
export function EnumField<Value extends string>({
  label,
  value,
  options,
  groupOf,
  onCommit,
}: EnumFieldProps<Value>) {
  const triggerId = useId();

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={triggerId}>
        {label}
      </label>
      <Select.Root
        onValueChange={enumCommitter(options, onCommit)}
        value={value}
      >
        <Select.Trigger className={styles.trigger} id={triggerId}>
          <Select.Value />
          <Select.Icon className={styles.icon}>▾</Select.Icon>
        </Select.Trigger>
        <Select.Content className={styles.content} position="popper">
          <Select.Viewport className={styles.viewport}>
            {groupOf === undefined
              ? options.map(listed)
              : grouped(options, groupOf).map(([name, members]) => (
                  <Select.Group key={name}>
                    <Select.Label className={styles.group}>{name}</Select.Label>
                    {members.map(listed)}
                  </Select.Group>
                ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
    </div>
  );
}
