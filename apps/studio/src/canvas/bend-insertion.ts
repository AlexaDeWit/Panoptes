/** The registered Add bend command reaches the mounted route controls. */
export const bendInsertionEvent = 'saerskriven:add-bend';

/** Requests insertion through the same control used by pointer users. */
export function startBendInsertion(): void {
  document.dispatchEvent(new Event(bendInsertionEvent));
}
