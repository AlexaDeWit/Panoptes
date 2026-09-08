import { z } from 'zod';

const selectionControlSchema = z.enum(['geometry', 'source', 'target']);
/** The editor requested by a selection command. */
export type SelectionControl = z.infer<typeof selectionControlSchema>;
/** The channel between registered commands and the mounted editor. */
export const selectionControlEvent = 'saerskriven:selection-control';

/** Focuses the open selection editor after a command or menu closes. */
export function focusSelectionControl(): boolean {
  const panel = document.querySelector<HTMLElement>('[data-selection-editor]');
  const target =
    panel?.querySelector<HTMLElement>('input, select') ??
    panel?.querySelector<HTMLElement>('button');
  target?.focus();
  return target !== undefined && target !== null;
}

/** Opens the selection editor through its registered command. */
export function openSelectionControl(control: SelectionControl): void {
  document.dispatchEvent(
    new CustomEvent(selectionControlEvent, { detail: control }),
  );
}

/** Reads a requested control from a browser event. */
export function selectionControlFrom(
  event: Event,
): SelectionControl | undefined {
  const parsed = selectionControlSchema.safeParse(
    event instanceof CustomEvent ? event.detail : undefined,
  );
  return parsed.success ? parsed.data : undefined;
}
