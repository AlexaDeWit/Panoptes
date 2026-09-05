# The studio's canvas

The diagram, interactive: React Flow mounted around the drawing primitives
in [`@panoptes/canvas`](../../../../packages/canvas/README.md), so the studio
and the headless renderer draw one picture from one set of numbers.

## What it derives, and what it holds

`layout.ts` holds the two selectors the canvas reads, the laid-out first
diagram of the model on screen and the selection. A layout is kept against
the model it came from and handed back while that model is the same object,
which saves the work and, more than that, is what lets the canvas subscribe
at all: zustand reads a store through `useSyncExternalStore`, which refuses a
snapshot that is a new object on every call. `names.ts` says what an element
is called to assistive technology, `nodes.ts` turns the layout into React
Flow's nodes and edges, and `changes.ts` turns what React Flow reports back
into store actions and dispatches them.

React Flow is mounted controlled. What it draws is rebuilt whole from the
model on every render, so a selection re-renders every node and every flow:
one pass over a diagram's elements with nothing measured, which is what lets
the canvas keep no view of the model of its own. What it does keep is what
React Flow reports about a gesture in flight, a dragged node's position among
it, folded back onto the model's own nodes as soon as the model moves. A
gesture reaches the store once, when it settles: one `MoveElement` carrying
the offset from where the model has the element, drag and key press alike.
What it asks for is settled against the store's own selection rather than the
one a render closed over, because React Flow reports a click that moves the
selection between a node and a flow as two synchronous calls with no render
between them.

## Accessibility

Every element is a tab stop, with an accessible name built out of model data:
what the element is called, what kind of element it is, and what its badge
says. The glyphs are hidden from assistive technology, so a badge would
otherwise be visual alone. A flow also names the elements its ends attach to.

Focus and selection are drawn apart and stack: focus is the app's own ring
(`--pn-focus-ring`) on the element the browser focused, selection a dashed
frame around a node or a heavier line along a flow. Both are an outline or a
border rather than a shadow, so forced-colours mode keeps them. Severity is
legible without colour on the canvas itself: a badge carries its count over a
letter for the severity.

Moving an element by keyboard is React Flow's own path: tab to it, Enter to
select it, then an arrow key moves it five model units, twenty with shift
held. Each press is one undoable `MoveElement`. React Flow announces the move
in a live region of its own and pans a newly focused element into view.

## What is not attempted here

- Connecting a flow is issue #39's. The handles a flow attaches to are drawn
  nowhere until then, and a flow selects but does not move: its geometry
  follows the elements its ends are attached to.
- Deleting is issue #41's, so the delete key is left unbound rather than
  taking a node off a canvas whose model would keep it.
- Selection is single. Multi-select and box select are unbound, because the
  store holds one selection and a plural gesture has no plural action behind
  it.
- Zoom and pan have no keyboard path: the wheel and a drag of the background
  do them. Reaching an element does not need one, since focusing an element
  pans it into view. Controls for both belong with the toolbar.
- Tab order is React Flow's DOM order, every flow before every element, so a
  keyboard user reaches the flows first. Choosing another order means
  ordering the DOM, which is the same decision as how a diagram is
  traversed, and that belongs with the toolbar rather than here.
- A flow that runs under a trust boundary cannot be selected with the
  pointer: React Flow paints every node above every edge, and a boundary is
  a node whose box takes the clicks over everything it encloses. The
  keyboard reaches it, and issue #39, which owns what a flow does, owns
  this too.
- React Flow's container carries `role="application"`, which turns off a
  screen reader's browse mode inside the canvas: Tab reaches every element
  but the reader's own navigation keys do not. React Flow writes the role
  after any property handed to it, so it cannot be overridden from here.
- One diagram is drawn, the model's first, until the studio can choose.
- A real model reaches the canvas through the store's development-only hook
  (`../store/development-model.ts`) until issue #37 lands the file dialogs.
