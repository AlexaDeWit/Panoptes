// Browser APIs jsdom implements nowhere, stubbed for the component specs.
// Radix's Select calls each one while it opens and positions its listbox, and
// an unimplemented method there fails the interaction rather than the
// assertion, so the reason a spec goes red would be jsdom rather than the
// component. Each stub is the smallest shape the caller reads, and each is
// assigned outright because jsdom defines none of them.

// Pointer capture: jsdom ships no Pointer Events implementation at all.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

// Scrolling: jsdom has no layout, so nothing can be scrolled into view.
Element.prototype.scrollIntoView = () => undefined;

// ResizeObserver: observed but never fired, since no element ever resizes.
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
