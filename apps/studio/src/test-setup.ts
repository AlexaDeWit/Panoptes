// Browser APIs jsdom implements nowhere, stubbed for the component specs.
// Radix's Select calls each one while it opens and positions its listbox, and
// an unimplemented method there fails the interaction rather than the
// assertion, so a spec would go red for the wrong reason. Each stub is the
// smallest shape the caller reads.

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
