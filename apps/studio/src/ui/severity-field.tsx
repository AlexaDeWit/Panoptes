import { severitySchema, type Severity } from '@panoptes/model';

import { EnumField } from './enum-field.js';

/** What a {@link SeverityField} shows and where an edit goes. */
export type SeverityFieldProps = {
  readonly value: Severity;
  readonly onCommit: (severity: Severity) => void;
};

/**
 * The severity of a threat, as a listbox over the model's own severity union.
 */
export function SeverityField({ value, onCommit }: SeverityFieldProps) {
  return (
    <EnumField
      label="Severity"
      onCommit={onCommit}
      options={severitySchema.options}
      value={value}
    />
  );
}
