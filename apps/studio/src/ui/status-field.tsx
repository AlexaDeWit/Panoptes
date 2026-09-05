import { threatStatusSchema, type ThreatStatus } from '@panoptes/model';

import { EnumField } from './enum-field.js';

/** What a {@link StatusField} shows and where an edit goes. */
export type StatusFieldProps = {
  readonly value: ThreatStatus;
  readonly onCommit: (status: ThreatStatus) => void;
};

/**
 * Where a threat stands, as a listbox over the model's own status union: the
 * open threat and the six dispositions it can reach.
 */
export function StatusField({ value, onCommit }: StatusFieldProps) {
  return (
    <EnumField
      label="Status"
      onCommit={onCommit}
      options={threatStatusSchema.options}
      value={value}
    />
  );
}
