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
 * and reports whether there was a panel to take it. The registered command
 * calls this channel because focus does not belong in the model store.
 */
export function focusThreatPanel(): boolean {
  return take?.() ?? false;
}
