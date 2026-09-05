# The studio's canvas

The diagram, interactive: React Flow mounted around the drawing primitives
in [`@panoptes/canvas`](../../../../packages/canvas/README.md), so the studio
and the headless renderer draw one picture from one set of numbers.

## What it derives, and what it holds

`layout.ts` holds the one selector the canvas reads: the first diagram of the
model on screen, laid out. It keeps the last answer and hands it back while
the model is the same object, because zustand compares what a selector
returns by identity and a fresh layout on every dispatch would redraw the
whole canvas over a selection. `nodes.ts` turns that layout into React Flow's
nodes and edges and names them, and `changes.ts` turns what React Flow
reports back into store actions.

React Flow is mounted controlled. The nodes and flows it draws come from the
model on every render, and the copy held beside the model carries only what
React Flow reports about a gesture in flight, the position of a node under
the pointer among it, so a drag stays smooth. That copy is folded back onto
the model's own nodes as soon as the model moves. A gesture reaches the store
once, when it settles: one `MoveElement` carrying the offset from where the
model has the element, whether the gesture was a drag or a key press. Nothing
else about the canvas is state, and nothing invalidates it by hand.

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
- One diagram is drawn, the model's first, until the studio can choose.
- A real model reaches the canvas through the store's development-only hook
  (`../store/development-model.ts`) until issue #37 lands the file dialogs.
