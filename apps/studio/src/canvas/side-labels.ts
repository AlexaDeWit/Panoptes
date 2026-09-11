import type { Side } from '@saerskriven/model';

/** What each side of an element is called in a control. */
export const sideLabels = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
} as const satisfies Record<Side, string>;
