import { useId } from 'react';
import { Select } from 'radix-ui';
import { type Severity, severitySchema } from '@panoptes/model';

import styles from './severity-field.module.css';

function narrowSeverity(candidate: string): Severity | undefined {
  const narrowed = severitySchema.safeParse(candidate);
  return narrowed.success ? narrowed.data : undefined;
}

/**
 * The listbox's value handler, bound to one `onCommit`. Radix reports a choice
 * as a plain string and the model's schema is the only authority on which
 * strings are severities, so this is where one becomes the other. The arm that
 * drops a value the schema does not name is unreachable from the markup below,
 * whose items are generated from that same schema, which is why the handler
 * sits beside the component: an unreachable arm is held by nothing unless a
 * spec can call it directly.
 */
export function severityCommitter(
  onCommit: (severity: Severity) => void,
): (chosen: string) => void {
  return (chosen) => {
    const severity = narrowSeverity(chosen);
    if (severity !== undefined) {
      onCommit(severity);
    }
  };
}

/** What a {@link SeverityField} shows and where an edit goes. */
export type SeverityFieldProps = {
  readonly value: Severity;
  readonly onCommit: (severity: Severity) => void;
};

/**
 * The severity of a threat, as a listbox over the model's own severity union.
 * `onCommit` is the single integration point: it fires once per chosen value,
 * already narrowed to the model's union, so the caller has one place to
 * dispatch a store action from.
 *
 * The open listbox stays inside this field rather than going to the document
 * body, so it sits in whichever landmark the panel around it declares.
 */
export function SeverityField({ value, onCommit }: SeverityFieldProps) {
  const triggerId = useId();

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={triggerId}>
        Severity
      </label>
      <Select.Root value={value} onValueChange={severityCommitter(onCommit)}>
        <Select.Trigger className={styles.trigger} id={triggerId}>
          <Select.Value />
          <Select.Icon className={styles.icon}>▾</Select.Icon>
        </Select.Trigger>
        <Select.Content className={styles.content} position="popper">
          <Select.Viewport className={styles.viewport}>
            {severitySchema.options.map((severity) => (
              <Select.Item
                className={styles.item}
                key={severity}
                value={severity}
              >
                <Select.ItemText>{severity}</Select.ItemText>
                <Select.ItemIndicator className={styles.indicator}>
                  ✓
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
    </div>
  );
}
