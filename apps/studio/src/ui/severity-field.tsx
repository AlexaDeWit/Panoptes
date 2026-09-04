import { useId } from 'react';
import { Select } from 'radix-ui';
import { type Severity, severitySchema } from '@panoptes/model';

import styles from './severity-field.module.css';

/** What a {@link SeverityField} shows and where an edit goes. */
export type SeverityFieldProps = {
  readonly value: Severity;
  readonly onCommit: (severity: Severity) => void;
};

/**
 * The severity of a threat, as a listbox over the model's own severity union.
 * `onCommit` is the single integration point: it fires once per chosen value,
 * with the value already narrowed by the model's schema, so the caller has
 * one place to dispatch a store action from.
 */
export function SeverityField({ value, onCommit }: SeverityFieldProps) {
  const triggerId = useId();

  const commit = (chosen: string): void => {
    const narrowed = severitySchema.safeParse(chosen);
    if (narrowed.success) {
      onCommit(narrowed.data);
    }
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={triggerId}>
        Severity
      </label>
      <Select.Root value={value} onValueChange={commit}>
        <Select.Trigger className={styles.trigger} id={triggerId}>
          <Select.Value />
          <Select.Icon className={styles.icon}>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className={styles.content} position="popper">
            <Select.Viewport className={styles.viewport}>
              {severitySchema.options.map((severity) => (
                <Select.Item
                  className={styles.item}
                  key={severity}
                  value={severity}
                >
                  <Select.ItemText>{severity}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
