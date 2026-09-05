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
into store actions and dispatches them. `elements.ts` builds the elements the
palette adds, `edits.ts` is the command side of the same boundary, one
function per edit a control asks for, `announcements.ts` carries what an edit
did to the region that says it, `viewport.ts` says whether a node is drawn
inside the canvas, and `palette.tsx` is the controls.

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

## Editing

Every edit is one dispatched action, so undo takes back exactly what one
gesture or one press did, and the canvas draws the result because it derives
from the store. A selection that follows an edit is a second dispatch and
costs no history, the store keeping selection out of its stacks. An edit the
model refuses moves nothing and is said by the failure notice rather than by
the region below, which speaks only for edits that landed.

- **Add.** One button per element kind, in the palette above the canvas. The
  element lands at the left edge of the diagram a gap below everything it
  draws, which is free whatever the diagram holds, since `bounds` is the ink
  the diagram lays down. It arrives named after the button that added it,
  selected, and holding focus. Successive adds stack downward, each below the
  one before.
- **Connect.** A flow runs from the selected element to the one chosen in the
  palette's listbox, which offers every other element the diagram draws. The
  pointer draws the same flow by dragging from a handle on one element to a
  handle on another. The handles are drawn on the element under the pointer
  and on the selected one, so a diagram at rest is not covered in dots, and a
  handle that stays hidden is still a place to drop a flow, React Flow
  resolving the nearest handle within its connection radius rather than hit
  testing the dot. Either way it is one `AddElement` carrying a flow with
  both ends attached and no waypoints, so the layout routes it. An element
  cannot be connected to itself: the layout resolves both ends of such a flow
  to one handle and would draw nothing.
- **Delete.** Delete or Backspace, with focus anywhere in the canvas, removes
  the selected element or flow as one `RemoveElement`. The cascade is the
  model's own: a flow attached to what went loses that end and keeps the
  other, and a threat that named it keeps its record and loses the link. The
  announcement counts both before the dispatch, since afterwards there is
  nothing left to count them from. Focus lands on the canvas, the element that
  held it having gone.
- **Resize.** A selected element the model can resize carries one control, at
  its bottom right corner, and the gesture reaches the store once, at its end,
  as one `ResizeElement`. React Flow reports an extent on every frame and
  again when it settles, and the settled report is the only one folded into an
  action, as with a drag.

The palette holds the region that says what an edit did, a polite live region
always in the page on the pattern [the failure notice](../ui/README.md) sets.
It is fed through a channel of its own rather than through the model store: an
announcement is not the model and must not ride the undo stacks, and the
palette and the canvas are siblings that both speak into the one region. What
it says is keyed by a count, so the same words twice over are announced twice:
a live region speaks when its content changes, and two adds of one kind say
the same sentence.

The canvas pans to the selected element where the whole of it is not in view,
which is what makes an element added below the diagram worth selecting and
focusing. React Flow pans to a focused node of its own accord, but only where
the node is wholly outside the view and the focus came from the keyboard, and
an edit's focus is neither.

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

Every edit has a keyboard path of its own. Adding is a button. Connecting is
selecting an element on the canvas, then choosing the other end in the
listbox beside those buttons and pressing Connect, which is why the source is
the selection rather than a mode to enter and leave. Deleting is the Delete or
Backspace key while the canvas holds focus. The palette's two connecting
controls are disabled while nothing is selected, so a keyboard user passes no
dead stop between the buttons and the canvas.

## What is not attempted here

- Resizing is pointer-only. React Flow's resize control is a drag on a corner
  and carries no key binding, and a keyboard path would be a size control of
  its own, which belongs with the toolbar. The corner is the only control
  offered, on every element the model resizes: a control on the top or the
  left moves the element as well as sizing it, which is two operations for one
  gesture where the store has one action per edit. A boundary curve carries
  none, the model giving it no extent to set.
- A flow selects but does not move, and its waypoints cannot be edited: its
  geometry follows the elements its ends are attached to.
- Nothing renames an element, so the elements the palette adds keep the names
  it gave them until a panel or an inspector can take one.
- Nothing pans to a flow that was just connected: a flow has no box, so
  whether it is in view is not the question a node's is.
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
  a node whose box takes the clicks over everything it encloses. It stays
  that way. Letting the clicks through means hit testing a boundary on its
  outline alone, which trades this limit for a worse one, a boundary
  draggable only by the two pixels of its dashed stroke. The keyboard
  reaches the flow, selects it, deletes it and connects from it, so nothing
  about a flow is out of reach by keyboard. The pointer alone is limited.
- React Flow's container carries `role="application"`, which turns off a
  screen reader's browse mode inside the canvas: Tab reaches every element
  but the reader's own navigation keys do not. React Flow writes the role
  after any property handed to it, so it cannot be overridden from here.
- One diagram is drawn, the model's first, until the studio can choose.
- A real model reaches the canvas through the store's development-only hook
  (`../store/development-model.ts`) until issue #37 lands the file dialogs.
