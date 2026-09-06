let take: (() => boolean) | undefined;

/**
 * Registers what moves focus into the threat panel, and hands back the
 * removal. The overlay registers itself while it is mounted, so the canvas
 * can offer a key press to the panel without holding a reference to it.
 */
export function panelFocusHandler(handler: () => boolean): () => void {
  take = handler;
  return () => {
    if (take === handler) {
      take = undefined;
    }
  };
}

/**
 * Moves focus into the threat panel, opening it again where Escape closed it,
 * and reports whether there was a panel to take it. It is a channel of its
 * own rather than a field of the model store, the way the canvas announces
 * ([the canvas](../canvas/announcements.ts)): where focus is is not the model
 * and must not ride the undo stacks. A caller left with `false` still holds
 * the press, so Enter on an element the panel is not open for does what it
 * did before.
 */
export function focusThreatPanel(): boolean {
  return take?.() ?? false;
}
