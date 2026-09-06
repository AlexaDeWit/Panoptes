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
function per edit a control asks for, `connecting.ts` holds the flow a chord
started until a target is chosen or the chooser closes, `announcements.ts`
carries what an edit did to the region that says it, `viewport.ts` is the
arithmetic of the view,
whether a node is drawn inside the canvas and the viewport that fits a diagram
into it, `view-commands.tsx` applies that to React Flow, and `palette.tsx` and
`zoom-cluster.tsx` are the controls.

The ground is graph paper: React Flow's own `Background` component ruled at
the grid spacing the canvas package's token module decides, so the lines scale
with the viewport and a zoom reads as one rather than as a grid that stayed
still. Its colour is handed over as `--xy-background-pattern-color` in the CSS
module beside `diagram-canvas.tsx`, which is where the studio's own
`--pn-colour-grid` reaches React Flow's pattern. The two colours a connection
handle is drawn in arrive the same way, as `--xy-handle-background-color` and
`--xy-handle-border-color`: React Flow reads each of its colours from a
property on the container before falling back to a `-default` it declares on
`.react-flow` itself, so the name without that suffix is the one a value set
above it reaches. The grid and the handles are what the studio colours in
React Flow's own parts here. The resize control at a selected element's corner
still wears React Flow's colour until #180 recolours it. What those colours are and why is the token
module's
([the visual system](../../../../packages/canvas/README.md#the-visual-system)).

The diagram's own colours arrive by the same route. What `diagram-canvas.tsx`
injects is `themedCanvasStylesheet`, the canvas sheet written in those same
custom properties rather than in values, so the drawing follows the colour
scheme the app root resolved and nothing here reads a scheme or holds a mode.
The CLI embeds the resolved sheet instead and stays light.

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

The flows follow that in-flight position without passing through here. A
dragged node's position reaches React Flow's own node store as the canvas
folds each frame in, and the flow edge reads it there
([the drawing primitives](../../../../packages/canvas/README.md)), so a line
is drawn to where its element is on every frame while the store still hears of
the move once. Only the moved node's own flows are redrawn, and only their two
anchors move: the names and the badges are placed over the whole diagram at
once, which is a pass the canvas takes at the drop rather than per frame, so
they stay where they were until then.

## Editing

Every edit is one dispatched action, so undo takes back exactly what one
gesture or one press did, and the canvas draws the result because it derives
from the store. A selection that follows an edit is a second dispatch and
costs no history, the store keeping selection out of its stacks. An edit the
model refuses moves nothing and is said by the failure notice rather than by
the region below, which speaks only for edits that landed.

- **Add.** One button per element kind, in the palette above the canvas, each
  running the tool command for the kind it adds and showing that command's
  key ([the commands](../commands/README.md)). The
  element lands at the left edge of the diagram a gap below everything it
  draws, which is free whatever the diagram holds, since `bounds` is the ink
  the diagram lays down. It arrives named after the button that added it,
  selected, and holding focus. Successive adds stack downward, each below the
  one before.
- **Connect.** A flow runs from the selected element to the one chosen in the
  palette's listbox, which offers every other element a flow can run between:
  the actors, processes and stores the diagram draws. A trust boundary is not
  one of them at either end, being what a flow crosses rather than a thing it
  flows to, and neither is a text note, which is about the diagram rather than
  a part of the system, as the model's own text schema describes it, a note
  carrying no threats. So a selected boundary or note leaves both controls
  disabled, neither is offered as a target, and neither draws a handle. Nor is
  a flow one of them, the layout having no geometry for a flow that ends on a
  flow. `connectElements` refuses both ends itself rather than leaving it to
  the controls, because the model takes an endpoint naming any element of the
  diagram and the layout then drops the flow it cannot place, which would
  leave a flow in the model and in the next saved file while it is drawn
  nowhere. The pointer draws the same flow by dragging from a handle on one
  element to a handle on another. The handles are drawn on the element under
  the pointer and on the selected one, so a diagram at rest is not covered in
  dots, and a handle that stays hidden is still a place to drop a flow, React
  Flow resolving the nearest handle within its connection radius rather than
  hit testing the dot. Which element is under the pointer is read in the CSS
  module beside `diagram-canvas.tsx` rather than held as state, so hovering
  costs no render of a canvas that rebuilds every node from the model.
  Releasing over empty canvas draws nothing and costs no undo step: React Flow
  reports a connection only where it resolved one, so `onConnect` is never
  reached and nothing is dispatched. Nothing is created there either, the
  epic's second wave holding quick-create back for the toolbox. Either way a
  flow drawn is one `AddElement` carrying a flow with both ends attached and
  no waypoints, so the layout routes it. An element cannot be connected to
  itself: the layout resolves both ends of such a flow to one handle and would
  draw nothing.
- **Start a flow.** The chord the registry gives the start-flow command opens
  the target chooser on the selected element, from wherever a person is and
  with nothing in the palette clicked ([the commands](../commands/README.md)).
  The chooser is the palette's own listbox, so the arrow keys and its
  typeahead move the choice, Enter commits and Escape cancels. What tells the
  two apart is `connecting.ts`: opened by the command it is a flow already in
  progress, and the choice draws it, where opened by hand it names a target
  the Connect control then draws between. Escape reaches Radix rather than the
  registry, an open overlay owning its own keys, so cancelling a flow leaves
  the selection where it was rather than clearing it. A selection no flow can
  run from starts nothing, the chooser being disabled there. The listbox
  carries no value while a flow is in progress, so a fresh flow opens with
  nothing chosen and the same target twice over is two flows. The toolbox
  replaces the palette in issue 175 and takes the chooser with it; what stays
  is the command.
- **Delete.** Delete or Backspace removes the selected element or flow as one
  `RemoveElement`. The command registry binds the two keys for the whole page
  ([the commands](../commands/README.md)), and the canvas binds them again for
  itself: a press the canvas has answered is marked handled, so one press is
  one removal whichever of the two took it. Consolidating the two into the
  registry alone is a follow-up. The cascade is the
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

The palette holds the region that says what an edit did, the studio's own
`LiveRegion` ([the controls](../ui/README.md)), always in the page and named
so a screen reader's landmark list says which region it reached.
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
an edit's focus is neither. The test is the whole of the element, so clicking
a node the edge of the canvas clips re-centres the view under the pointer. It
is the selection moving that pans rather than the model changing under a
selection that stays, so dragging the selected element to the edge leaves it
where it was dropped.

What counts as in view is what the threat panel is not over. The panel opens
on the same selection this pans for ([the panel](../panel/README.md)), so an
element under it is an element out of sight, and the pan centres what it
reveals in the room the panel leaves rather than in the canvas.
`clearOfPanel` and `revealCentre` in `viewport.ts` are that arithmetic, over
`panelCover`, which is what the panel covers: its border box and the inset it
floats at. That number has one home, the canvas package's token module, which
declares it on the document root as `--pn-panel-cover` for the panel's own
stylesheet to size its box from ([the visual
system](../../../../packages/canvas/README.md#the-visual-system)), so a panel
drawn wider than the pan expects is not a state the two can reach.

## The panel over it

The threat panel is mounted here, inside the canvas container, which is what
makes it an overlay on the diagram rather than a column taken off it ([the
panel](../panel/README.md)). Two gestures cross the boundary between the two.
Enter on the element the store has selected hands the panel the keyboard,
which the canvas reads in the capture phase: React Flow answers Enter on a
node itself, and by the time the press has bubbled the selection it reports
has already moved, so a press read on the way up could not tell selecting an
element from asking for the panel of one already selected. A press the panel
does not take is left to React Flow. The other way, Escape in the panel puts
focus back on the element, through `focusElement`, which is the same route an
added element takes to focus.
## What a gesture will do, said before it is made

Nothing about selection or hover is carried by colour alone, so what is
selected reads in greyscale, in forced colours and at any zoom. A selected
element takes a dashed frame a step heavier than the outline it is drawn
with, and the handles a flow runs from. A flow has no box to frame, so the
weight of its own line carries both states: heavier under the pointer, and
heavier again once selected. The three weights are the token module's
`cueWidths`
([the visual system](../../../../packages/canvas/README.md#the-visual-system)),
reaching the CSS module beside `diagram-canvas.tsx` as `--pn-cue-*`
properties, so a cue is measured against the weight the drawing itself was
laid down at rather than against a literal in a stylesheet.

The canvas package draws its own edge body rather than React Flow's, and
React Flow's is what carries the wider invisible path a built-in edge is hit
tested on. So a flow here is hit tested on the line as drawn, which is what
makes widening that line under the pointer both the cue and the band. What
that band should be is issue 191's, along with the boundary hit testing named
below.

The pointer says what a click would do. React Flow's own sheet already lands
`pointer` on a flow, `crosshair` on a handle a flow is drawn from, and `grab`
then `grabbing` on the background that pans. What the studio adds is
`pointer` over an element, which React Flow leaves at the `grab` it gives any
draggable node, so the cursor speaks for the selection a click makes rather
than for the drag. The other two cursors the epic asks for belong to the tool
modes of issue 175, and the CSS module holds them against a `data-tool`
attribute on the canvas container: `select`, which is the attribute absent
and the rules above, `place`, a crosshair over the whole canvas because a
placement tool draws where the click lands, and `hand`, the pan's own grab
everywhere. Nothing sets the attribute until 175 does.

The control that resizes the selected element is a square where the handle a
flow is drawn from is a circle, and the two sit at the same corner, so shape
rather than colour tells them apart. Its cursor names the direction it sizes
in, and it is on the selected element alone, React Flow mounting it from
`selected` (the Resize bullet above).

What counts as in view is what the threat panel is not over. The panel opens
on the same selection this pans for ([the panel](../panel/README.md)), so an
element under it is an element out of sight, and the pan centres what it
reveals in the room the panel leaves rather than in the canvas.
`clearOfPanel` and `revealCentre` in `viewport.ts` are that arithmetic, over
`panelCover`, which is what the panel covers: its border box and the inset it
floats at. That number has one home, the canvas package's token module, which
declares it on the document root as `--pn-panel-cover` for the panel's own
stylesheet to size its box from ([the visual
system](../../../../packages/canvas/README.md#the-visual-system)), so a panel
drawn wider than the pan expects is not a state the two can reach.

## The panel over it

The threat panel is mounted here, inside the canvas container, which is what
makes it an overlay on the diagram rather than a column taken off it ([the
panel](../panel/README.md)). Two gestures cross the boundary between the two.
Enter on the element the store has selected hands the panel the keyboard,
which the canvas reads in the capture phase: React Flow answers Enter on a
node itself, and by the time the press has bubbled the selection it reports
has already moved, so a press read on the way up could not tell selecting an
element from asking for the panel of one already selected. A press the panel
does not take is left to React Flow. The other way, Escape in the panel puts
focus back on the element, through `focusElement`, which is the same route an
added element takes to focus.


## The view

Opening a model fits the viewport to the whole of the diagram it carries.
React Flow fits on mount alone, so a file opened over the model before it was
drawn at that model's zoom and mostly off screen. `viewport.ts` holds the
calculation, pure over the laid-out diagram's ink and the canvas's extent,
with one padding constant that leaves the floating chrome room: the zoom
cluster bottom right, and the toolbox of issue 175, which reads the same
number. The zoom a fit lands on is held inside the range React Flow itself is
given, so a fit cannot leave the view somewhere a later gesture snaps away
from, and React Flow's own floor of 0.5 is not far enough out to draw Écluse's
model whole.

What is fitted is the model as it arrived, read by identity from the store
([the selectors](../store/selectors.ts)): a second open is a second model
object and fits again, an edit is not a model as it arrived and moves nothing,
and a save leaves the model where it is. `FitOnOpen` applies it from inside
React Flow, which is what holds the canvas's extent, and the same calculation
answers the fit-to-view command, so a control and an open cannot disagree
about where the diagram sits.

The controls are `zoom-cluster.tsx`, three icons floating over the bottom
right of the canvas, each one registered command showing its chord in a
tooltip ([the commands](../commands/README.md)).

## Accessibility

Every element is a tab stop, with an accessible name built out of model data:
what the element is called, what kind of element it is, and what its badge
says. The glyphs are hidden from assistive technology, so a badge would
otherwise be visual alone. A flow also names the elements its ends attach to.

Focus and selection are drawn apart and stack: focus is the app's own ring
(`--pn-focus-ring`) on the element the browser focused, selection the frame
and the weights above. Both are an outline or a border rather than a shadow,
so forced-colours mode keeps them. Severity is legible without colour on the
canvas itself: a badge carries its count over a letter for the severity.

Moving an element by keyboard is React Flow's own path: tab to it, Enter to
select it, then an arrow key moves it five model units, twenty with shift
held. Each press is one undoable `MoveElement`. React Flow announces the move
in a live region of its own and pans a newly focused element into view.

Every edit has a keyboard path of its own, and every one of them is a
registered command with its chord shown beside it ([the
commands](../commands/README.md)). Adding is a button or the tool's own
letter. Connecting is selecting an element on the canvas and then pressing the
start-flow chord, which opens the chooser on it and draws the flow the choice
commits, which is why the source is the selection rather than a mode to enter
and leave. The same listbox reached by hand still names a target for the
Connect control beside it. Deleting is the Delete or Backspace key, from
anywhere in the studio. The palette's two connecting controls are disabled
while nothing is selected, so a keyboard user passes no dead stop between the
buttons and the canvas.

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
- Nothing pans to a flow that was just connected, and nothing pans a selected
  flow out from under the threat panel: a flow has no box, so whether it is in
  view is not the question a node's is.
- A connection released over empty canvas cancels and creates nothing. Drawing
  an element there and attaching the flow to it is quick-create, which the
  epic holds for its second wave and names an alias of the toolbox rather than
  a command of its own.
- Selection is single. Multi-select and box select are unbound, because the
  store holds one selection and a plural gesture has no plural action behind
  it.
- Panning has no keyboard path: a drag of the background does it. Reaching an
  element does not need one, since focusing an element pans it into view.
  Zooming and fitting have both a chord and a control of their own ([the
  commands](../commands/README.md)).
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
  about a flow is out of reach by keyboard. The pointer alone is limited, and
  it shows no hover cue there either, the boundary being what the pointer is
  over.
- React Flow's container carries `role="application"`, which turns off a
  screen reader's browse mode inside the canvas: Tab reaches every element
  but the reader's own navigation keys do not. React Flow writes the role
  after any property handed to it, so it cannot be overridden from here.
- One diagram is drawn, the model's first, until the studio can choose.
- A real model reaches the canvas through the store's development-only hook
  (`../store/development-model.ts`) until issue #37 lands the file dialogs.
