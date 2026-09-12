# The studio's canvas

The diagram, interactive: React Flow mounted around the drawing primitives
in [`@saerskriven/canvas`](../../../../packages/canvas/README.md), so the studio
and the headless renderer draw one picture from one set of numbers.

## What it derives, and what it holds

`layout.ts` holds the laid-out diagram on screen, the one the store names as
active or the first the model holds. The store selectors provide the
selection. A layout is kept against the model it came from and the diagram
it drew, and handed back while that model is the same object,
which saves the work and, more than that, is what lets the canvas subscribe
at all: zustand reads a store through `useSyncExternalStore`, which refuses a
snapshot that is a new object on every call. `names.ts` says what an element
is called to assistive technology, `nodes.ts` turns the layout into React
Flow's nodes and edges, and `changes.ts` turns what React Flow reports back
into store actions and dispatches them. `elements.ts` builds the elements the
toolbox places and settles click and drag geometry, `tools.ts` holds the active
mode outside the model store, and `placement.tsx` binds that mode to pointer
and Enter gestures. `edits.ts` is the command side of the same boundary, one
function per edit a control asks for. `connecting.ts` holds the
flow a chord started until a target is chosen or the chooser closes,
`rename-field.tsx` holds the inline name and Note editors and the node and edge
bodies that mount them. `announcements.ts` carries what an edit did to the region that says it,
and `viewport.ts` is the arithmetic of the view,
whether a node is drawn inside the canvas and the viewport that fits a diagram
into it, `view-commands.tsx` applies that to React Flow, and `toolbox.tsx` and
`zoom-cluster.tsx` are the controls. `toolbox.tsx` holds two of them: the tool
modes, which the shell mounts as row two of its chrome card, and the canvas
announcement and flow chooser, which hang under that card. Neither reads a
React Flow hook, which is what lets the shell host them.

The canvas is the studio's window: it fills the viewport. The chrome card, the
threat panel and the zoom cluster float inside it instead of taking space from
the diagram. `../app/chrome.tsx` is the card: one box centred at the top
holding the menu button, the diagram control and the tool modes ([the file
menu](../files/README.md)). Its measured height reaches the threat panel and
the selection controls as `--pn-chrome-block-size`, so a tools row that wraps
on a narrow viewport moves both.

React Flow draws the graph-paper ground at the grid spacing from the canvas
package. The studio supplies its grid and connection-handle colours through
React Flow's custom properties. Its CSS draws resize controls with the same
token table ([the visual system](../../../../packages/canvas/README.md#the-visual-system)).

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
gesture reaches the store once when it settles. A single move dispatches
`MoveElement`. A group move dispatches `MoveElements` with one shared offset.
What it asks for is settled against the store's own selection rather than the
one a render closed over, because React Flow reports a click that moves the
selection between a node and a flow as two synchronous calls with no render
between them.

Each flow reads its endpoint nodes during a drag. Selected flow waypoints move
by the group offset. Names and badges keep their place on the moving segment.
When pointer movement pauses, the canvas runs the collision search for the
whole transient layout. Pointer-up runs it once more before the model store
receives its one action.

## Editing

### Selection and reuse

A stationary background click or touch tap clears selection in Select, Hand,
and held Space. A pan keeps it. Empty space inside a boundary is background.
The boundary's outline, name, and controls still select or edit the boundary.
Tab changes focus without clearing selection. A cleared selection returns
focus to the canvas and uses the shared status announcement.

Copy, Cut, Paste, and Duplicate live in the Edit menu and shortcut registry.
Text fields keep their native clipboard keys. Copy includes the selected
elements, the attached endpoints of selected flows, and flows between copied
nodes. A free endpoint stays free. It includes attached threats, related
mitigations, and assumptions once each. Their copied links name copied
records only. The announcement counts excluded external links. Original
records keep their links.

The system clipboard carries a marked native YAML selection. Reads use the
format reader's size, alias, and depth limits. A malformed or unsupported
selection produces no edit. A failed copy leaves the existing clipboard and
document alone. Cut waits for the write and removes only the original
selection. A changed document or selection during that wait cancels removal.
The ordinary removal rules keep original threat records and detach other
flows. Paste and Duplicate give every copied record a new ID, and insertion
issues new threat numbers. Each insertion is one undo step. Repeated Paste
offsets the copies by another grid interval. Duplicate leaves the clipboard
alone. Source-format fields outside the model are not copied, which the
announcement reports for Threat Dragon files.

### Geometry, arrangement, and endpoints

Position and size opens a non-modal editor with coordinates, dimensions,
and step buttons. Apply commits the whole form as one edit. Cancel and Escape
leave the document and history alone. Multiple selected nodes move together.
Boundary curves can move but have no dimensions to resize.

Change flow source and Change flow target offer the diagram's actors,
processes, and stores in a chooser, beside a Side field that pins the end to
the top, right, bottom or left of that element or leaves it Automatic. Apply
changes only the chosen endpoint. The flow keeps its ID, name, route, scope
fields, and attached threats. Choosing the other endpoint's node is
unavailable. Cancellation costs no history. Both editors return focus to the
selected element when closed.

Toggle bidirectional flow, beside those two commands, makes the selected
flow run both ways or one way again, as one undo step. The flow keeps its
source and target, which is what the file formats and the register name it
by, and the canvas draws an arrowhead at each end.

Align uses the selected nodes' outer bounds. Left, centre, right, top, middle,
and bottom each move the nodes in one action. Distribution orders nodes by
coordinate, keeps the first and last fixed, and makes the gaps equal.
Overlapping outer nodes can produce negative gaps. Arrangement includes
boundary shapes. Attached flows follow their endpoints. Flow bends and free
endpoints stay where they were.

Snap to grid is an explicit View setting, initially off. It snaps node
dragging to the visible grid. Geometry fields and keyboard edits keep their
specified coordinates. Changing the setting leaves the document and history
alone.

The zoom cluster shows the current percentage. Its percentage button resets
zoom to 100%. Fit selection includes selected flows, their labels, and badges,
and uses the measured threat-pane width to keep the selection clear. View commands add no undo entries
and do not dirty the model.

### Flow route

Select one flow to reveal its bend handles, an end handle on each attached
end, and the Add bend control. Pull any segment of the line to create a bend.
Drag a handle to move a bend. Click a handle for Remove bend or Move bend.
Move bend accepts a destination click, so moving does not require a held drag.

An end handle sits where the flow meets its element. Drag it to another side
of that element to pin the end there, whatever the route does afterwards, or
click it for Follow the route, Top, Right, Bottom and Left. A focused end
handle takes an arrow key as the side it points at, and Delete or Backspace
returns the end to following the route. A pinned side is the model's, so it
saves, and a Threat Dragon file carries it as the port the flow fastens to.

Add bend, or `+`, highlights a segment. Left/Right chooses a segment and
Enter starts a bend at its midpoint. Arrow keys position the preview by five
model units, or twenty with Shift. Enter commits the insertion and Escape
cancels it. Pointer users can click a segment and then its destination.
Existing handles also accept arrow keys. Delete or Backspace on a focused
handle removes that bend alone. Removing the final bend restores a direct line.

Each completed drag or insertion is one undo step. Cancellation and returned
drags leave the model and history unchanged. Selection, model, tool, and inline
editor changes invalidate previews. A window blur cancels an active gesture.
Tab leaves insertion without saving it. Coordinates remain unsnapped.

`flow-bends.ts` owns the preview and model edit, for a bend and for an end's
side alike. `flow-bend-interaction.ts` binds pointer and keyboard gestures,
and `flow-bend-controls.tsx` draws their controls. Add bend lives in the
command registry. The `bend-insertion.ts` event connects that command to the
mounted controls.

### Element edits

Every edit is one dispatched action, so undo takes back exactly what one
gesture or one press did, and the canvas draws the result because it derives
from the store. A selection that follows an edit is a second dispatch and
costs no history, the store keeping selection out of its stacks. An edit the
model refuses moves nothing and is said by the failure notice rather than by
the region below, which speaks only for edits that landed.

- **Select.** A click replaces the selection. Shift-click or Shift+Enter on a
  focused element adds or removes it. Control+A or Command+A selects every
  element in the diagram. A background drag in Select draws a box and takes
  every node and drawn flow wholly inside it. The store holds the result as a
  unique, ordered ID array. Select rests on the arrow cursor. Hand, selected
  with H or held with Space, pans with a hand cursor.
  Dragging any selected node moves the full selection.

- **Place.** Select, Actor, Process, Store, Boundary box, Boundary curve, Note
  and Hand are icon buttons on row two of the chrome card. Each button shows
  every shortcut its registered command owns ([the
  commands](../commands/README.md)), in a tooltip that opens downward so it
  does not cover the row above it.
  A click with an element tool places its default size under the pointer.
  Pointer-down draws that geometry through the shared element glyph. A Note
  uses the same box geometry and draws no outline. A drag updates the box
  between opposite corners. A process takes the
  shorter axis and anchors the resulting square in the drag direction.
  Drag geometry reserves the outline's half-stroke on each exposed side.
  The rendered ink and the selection frame stay inside the pointer rectangle.
  Movement under four screen pixels remains the centred default. Any longer
  movement keeps its pointer rectangle. A thin element reduces its stroke to
  fit. Pointer-up commits one edit.
  Pointer cancellation, Escape, a tool change or a model replacement drops
  the preview without an edit. Enter places the default at the viewport centre.
  A placed shape arrives with a placeholder name and is selected. Its name
  opens in the in-place field when that field fits. A Note opens its prose
  field at every size. Its one `AddElement` is one undo step. The tool
  then returns to Select, unless a double click on its icon locked it for
  repeated placement. Escape returns to Select and unlocks it.
- **Boundary curve.** Each click commits one waypoint and the transformed
  viewport shows the route in progress. Enter or a double click finishes once
  it has at least two waypoints. Escape changes back to Select and drops the
  draft, which never reached the model and costs no undo step. A curve placed
  by Enter before a waypoint exists uses the same default arch a click-sized
  curve does. Freehand sampling is unavailable.
- **Connect.** A flow runs between the actors, processes and stores the
  diagram draws. A trust boundary is not one of them at either end, being what
  a flow crosses rather than a thing it flows to, and neither is a text note,
  which is about the diagram rather than a part of the system, as the model's
  own text schema describes it, a note carrying no threats. Nor is a flow one
  of them, the layout having no geometry for a flow that ends on a flow.
  `connectElements` refuses both ends itself rather than leaving it to the
  controls, because the model takes an endpoint naming any element of the
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
  reached and nothing is dispatched. A completed connection is one
  `AddElement` carrying a flow with both ends attached and
  no waypoints, so the layout routes it. An element cannot be connected to
  itself: the layout resolves both ends of such a flow to one handle and would
  draw nothing.
- **Start a flow.** The chord the registry gives the start-flow command opens
  the target chooser on the selected element, from wherever a person is and
  with no flow tool ([the commands](../commands/README.md)). `CanvasMessages`
  mounts the listbox under the card only while that command is in progress, so
  the arrow keys and typeahead move the choice, Enter commits and Escape
  cancels. Escape reaches
  Radix rather than the registry, an open overlay owning its own keys, so
  cancelling leaves the selection where it was. A selection no flow can run
  from starts nothing.
- **Delete.** Delete or Backspace removes the selection as one `RemoveElement`
  or `RemoveElements`. The command registry binds both keys for the whole page
  ([the commands](../commands/README.md)), and the canvas binds them again for
  itself: a press the canvas has answered is marked handled, so one press is
  one removal whichever of the two took it. The cascade is the
  model's own: a flow attached to what went loses that end and keeps the
  other, and a threat that named it keeps its record and loses the link. The
  announcement counts the full cascade before the dispatch and reports it
  once. Focus lands on the canvas after the focused element goes.
- **Edit canvas text.** Double-clicking an element or flow, or pressing Enter
  with one selected, opens a field where the diagram draws its text: over the
  glyph for an element and over the label for a flow, at the placement the
  layout settled, so nothing has to be looked for. The glyph draws no text of
  its own while the field is open, so the text is read in one place, and the
  field is set in the type the text is drawn in, wraps to the same width and
  grows to the lines it holds, up to the room the element's box leaves it,
  past which it scrolls. F2 is an alias for names.
  Enter commits a name and Escape leaves it as the model holds it. Focus goes
  back to the element on both. Leaving the field for another control commits
  as well and leaves focus where the click put it. The field is labelled
  "Name of" what it renames, so a screen reader hears which element it is in.
  A commit is one `RenameElement` and so one undo step, and a name the model
  already holds dispatches nothing, on the panel's own commit rule ([the
  panel](../panel/README.md)). A placed element starts with "New
  actor" through "New trust boundary curve", and a drawn flow "New flow",
  which is a placeholder until it is renamed rather than a name anyone chose.
  Which element has its name open is store state, not the canvas's own, so the
  command reaches it with nothing of the canvas mounted above it ([the
  store](../store/README.md)). A name the model refuses is not committed at
  all: it stays in the field to be corrected, with the character named under
  it and the same sentence said in the region below, the way the panel refuses
  a threat's field. A Note uses the same gesture to open its multiline prose
  field. Enter adds a line. Leaving the field or pressing Control or Command
  with Enter commits one `EditNote`. Escape leaves its prior prose. Because a
  double-click edits text, it no longer zooms.
- **Resize.** A selected resizable element carries a line control on each side
  and a handle at each corner. A side changes one axis. A corner changes both.
  The opposite side stays fixed, including when the top or left control moves
  the element. React Flow reports the settled position and size in model
  coordinates. The studio dispatches that pair once as one `ResizeElement`,
  so pan, zoom and drag frames add no model edits. Width and height stop at ten
  model units.

The canvas announcement is the studio's unnamed status host ([the
controls](../ui/README.md)), hanging under the chrome card. It reports an edit
only when the next focus does not expose the result. Canvas and threat
deletion, refused text, and completed Undo or Redo commands use it. Placement,
connection, renaming, threat adds, field edits, and keyboard moves rely on
their focused control or React Flow's message instead.

The status is outside the model store because it does not belong in the undo
stacks. The empty host stays mounted, and a sequence key makes repeated words
arrive as separate messages. The store defines when a message ends
([the store](../store/README.md#the-shape)).

Selecting an element leaves the viewport where it is, even when the element is
at the canvas edge or under the threat panel ([the panel](../panel/README.md)).
Dragging a selected element to the edge also leaves it where it was dropped.
Explicit fit commands use the area left of the open threat pane. The
`panelCover` token sets the default width only ([the panel](../panel/README.md)).

## The panel over it

The threat panel is mounted here, inside the canvas container, which is what
makes it an overlay on the diagram rather than a column taken off it ([the
panel](../panel/README.md)). T runs the Focus threats command and lands on
"Add a threat" for the one selected element. The command opens a panel that
Escape closed. Escape in the panel puts focus back on the element through
`focusElement`, which is the same route an added element takes to focus.
Focus retries stop when the model state changes or another control takes
focus, so a pending return cannot close the next inline editor.

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

The canvas package draws each flow and adds React Flow's invisible interaction
path at the `interactionWidths.flow` width. The same edge wrapper holds the
name, so a click on the line, its wider interaction path or the name selects
the flow.

React Flow uses manual z-index values here. A boundary is at -1, a regular
node at 0 and a selected regular node at 1. Selection therefore keeps a
regular node visible without raising a boundary above enclosed items. The
boundary's interior passes pointer events through. Its name, resize control
and an invisible `interactionWidths.boundary` stroke around its outline
remain selectable and draggable. Its disabled connection handles cannot take
an outline drag.

Select rests on the plain arrow over the pane and nodes. A flow keeps its link
pointer, and a connection handle keeps its crosshair. Place uses a crosshair
over the canvas. Hand uses `grab`, then `grabbing` during its pan.

Four lines resize a selected element from its sides. Four square handles
resize it from its corners. A side line takes the pointer away from the round
connection handle at the midpoint. Each control uses a directional cursor and
shows hover and keyboard focus ([Resize](#editing)).

## The view

Opening a model fits its diagram to the viewport. `viewport.ts` calculates
the fit from the diagram's ink bounds, the canvas extent, and padding for the
floating controls. The result stays within the configured zoom range.
React Flow's default minimum zoom of 0.5 cannot fit the full Écluse model.

What is fitted is the model as it arrived, read by identity from the store
([the selectors](../store/selectors.ts)): a second open is a second model
object and fits again, an edit is not a model as it arrived and moves nothing,
and a save leaves the model where it is. `FitOnOpen` applies it from inside
React Flow, which is what holds the canvas's extent, and the same calculation
answers the fit-to-view command. Opening uses the full canvas extent.
Explicit fitting uses the area left of the open threat pane.

The controls are `zoom-cluster.tsx`, three icons floating over the bottom
right of the canvas, each one registered command showing its chord in a
tooltip ([the commands](../commands/README.md)).

The placeholder is only its small diagram. No instruction line appears over
it during startup.

Scrolling over the canvas pans in both directions. A trackpad pinch keeps its
zoom gesture. Touch drag pans while Select is active, without starting a
selection box or clearing the selection. A mouse drag still draws the Select
box, while Hand or held Space makes a mouse drag pan from anywhere.
In Select mode, middle-button dragging pans without changing the selection.

## Accessibility

Every element is a tab stop, with an accessible name built out of model data:
what the element is called, what kind of element it is, and what its badge
says. The glyphs are hidden from assistive technology, so a badge would
otherwise be visual alone. A flow also names the elements its ends attach to,
from one to the other, or between the two where it runs both ways.

Focus and selection are drawn apart and stack: focus is the app's own ring
(`--pn-focus-ring`) on the element the browser focused, selection the frame
and the weights above. Both are an outline or a border rather than a shadow,
so forced-colours mode keeps them. Severity is legible without colour on the
canvas itself: a badge carries its count over a letter for the severity.

Moving by keyboard starts on React Flow's path: tab to an element and press
Enter to select it. A second Enter edits its text. An arrow moves one selection
five model units. Shift moves it twenty. Each press is one undoable singular or
group action. Shift+Enter adds or removes the focused element. React Flow
announces moves in its live region.

Every edit has a keyboard path. Page commands have their chords in the command
registry ([the commands](../commands/README.md)). The shortcut reference reads
contextual canvas keys from `../commands/contextual-shortcuts.ts`. Canvas event
handlers and accessible descriptions read the same entries. Placing is
selecting a tool by its button, letter or number and then clicking, dragging
or pressing Enter. Note follows
that path and puts focus in its multiline editor. Connecting is
selecting an element on the canvas and then pressing the
start-flow chord, which opens the chooser on it and draws the flow the choice
commits, which is why the source is the selection rather than a mode to enter
and leave. Deleting is the Delete or Backspace key, from anywhere in the
studio. The connector listbox exists only while that command is in progress,
so it adds no dead stop to the tab path. The card comes before the canvas in
the page, so Tab runs the menu button, the diagram control and the tool modes
before the first element.
Editing text is Enter on one selected element. F2 remains the name-editing
alias. T focuses the threat panel. A field keeps every key a person types,
Escape and Backspace among them: a chord fires inside a control that takes
characters only where the registry exempts it ([the
commands](../commands/README.md)).
Resizing starts on one of the named side or corner controls inside a selected
element. An arrow key moves the matching edge five model units. Shift moves it
twenty. Each press is one undo step, and the opposite edge stays fixed.

## What is not attempted here

- A flow alone selects but does not move. A group move translates its
  waypoints and free ends. Its attached ends follow their elements.
- Nothing pans to a flow that was just connected, and nothing pans a selected
  flow out from under the threat panel: a flow has no box, so whether it is in
  view is not the question a node's is.
- A connection released over empty canvas cancels and creates nothing. Drawing
  an element there and attaching the flow to it is unavailable.
- A rename the model refuses keeps its field open until the name is corrected
  or Escape is pressed, wherever the selection goes meanwhile. The draft is
  the field's alone, as a refused threat field is the panel's, and dropping it
  on a selection moving would drop what was typed. Beginning a rename on
  another element is where it does go: that field is the one that opens, and
  the refused draft goes with the field it was in.
- A flow's full drawn bounds must sit inside a selection box. An unplaced flow
  has no drawn bounds, so Select All and box selection leave it out.
- A selection box stays inside the current viewport. Pan before drawing a box
  around elements outside it.
- Reaching an element does not pan the canvas. Zooming and fitting have both a
  chord and a control of their own ([the commands](../commands/README.md)).
- Tab order follows React Flow's DOM order, with every flow before every node.
- React Flow's container carries `role="application"`, which turns off a
  screen reader's browse mode inside the canvas: Tab reaches every element
  but the reader's own navigation keys do not. React Flow writes the role
  after any property handed to it, so it cannot be overridden from here.
- The canvas draws one diagram at a time. The switcher joined to the menu
  button and the Next and Previous diagram commands switch between them, and
  the switcher adds and renames diagrams (`diagrams.ts`). Removing and
  reordering diagrams is not offered: #316 holds the model operations that
  work would build on.
