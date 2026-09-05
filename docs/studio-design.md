# Studio design

The UX design for `apps/studio`, written down before more features stack on
the M4 shell. Issue #168 is the epic; each section records what the
maintainer has ruled, marks the defaults the team lead took, and names what
is still open. A slice cut from this document cites the section it
implements.

Status: draft for ratification. Rulings dated 2026-09-05.

## Principles

- **The diagram is the editor.** The canvas takes every pixel the chrome does
  not need, and the chrome overlays the canvas rather than docking beside it.
- **One home per command.** A command lives in one place (menu, toolbox, or
  panel) and reaches the keyboard through one shortcut, shown beside it.
- **Synthesis, not imitation.** Tool modes and the floating chrome follow
  Excalidraw, whose interaction model people already know. Connectors follow
  FigJam: a flow is drawn from an element's handle, never bound by proximity,
  which Excalidraw gets wrong for a diagram whose edges carry meaning.
- **Keyboard parity.** Every gesture has a keyboard route, and no overlay
  traps focus. The M4 definition of done makes canvas accessibility a
  requirement rather than a deferral.
- **No modal dialogs.** Overlays are non-modal: the canvas stays live behind
  them.

## Shell

Four overlays over one canvas.

### Canvas

Fills the window. Opening a file fits the diagram to the viewport (#171), and
the fit leaves room under the toolbox so nothing lands beneath it.

### Menu, top left

A burger button opens a menu over the canvas. Two groups, in order:

| Group | Items                           |
| ----- | ------------------------------- |
| File  | Open, Save, Save as, Close file |
| Edit  | Undo, Redo                      |

Close file carries the unsaved-changes guard. "Exit" arrives with the
desktop shell (M5) and means the same thing there. Every item shows its
shortcut. Menu semantics are the standard ones: arrow keys move, Enter
activates, Escape closes and returns focus to the button.

The button shows a dot while there are unsaved changes, and the open menu
names the file, its format, and the loss report of a lossy read, because the
overlay shell removes the file bar that held them.

### Toolbox, top centre

A floating row of icon buttons, one per tool, each with an accessible name
and a tooltip carrying the shortcut. Tools are modes, per
[Tool modes](#tool-modes) below.

### Threat panel, right

Overlays the canvas only while exactly one element is selected. Behaviour is
in [Threat panel](#threat-panel) below.

### Cluster, bottom right

Zoom in, zoom out, fit to view, each a shortcut as well.

### Announcements

The live regions stay, visually hidden. A notice that needs the eye (a lossy
read, a refused save) shows as a transient message that also lands in a live
region, and stays reachable in the menu afterwards.

## Tool modes

A tool is a mode: pick it by click or key, then act on the canvas. After one
placement the tool returns to Select and the placed element is selected, so
the panel opens and the name field is one keystroke away. Double-clicking a
tool locks it for repeated placement, as Excalidraw does, and Escape unlocks.

| Tool           | Keys          | Click                          | Drag                                      |
| -------------- | ------------- | ------------------------------ | ----------------------------------------- |
| Select         | V, Escape, 1  | Select; empty canvas clears    | Box select (#156); on an element, move    |
| Actor          | A, 2          | Place at default size, centred | Draw to size, corner to corner            |
| Process        | P, 3          | Same                           | Same; the circle takes the shorter side   |
| Store          | S, 4          | Same                           | Same                                      |
| Boundary box   | B, 5          | Same                           | Same                                      |
| Boundary curve | C, 6          | Each click adds a waypoint     | Deferred: see [Second wave](#second-wave) |
| Hand           | H, Space held | Pan                            | Pan                                       |

Rules that hold across tools:

- One placement is one undo step. A cancelled placement leaves no step.
- A press that moves under a few pixels is a click, so a shaky click never
  draws a one-pixel element.
- A placed element gets a placeholder name, and the panel opens on the name
  field, so nothing lands unnamed unseen.
- With a tool active, Enter places at the viewport centre at default size.
  For a boundary curve, Enter or a double click finishes the curve and Escape
  discards it.
- Number keys mirror Excalidraw's order for people who know it; letters are
  for people who read the tooltip.

There is no flow tool. Flows are connectors, below.

## Connectors

A flow is drawn from an element: handles show on hover and on selection, and
dragging from a handle to another element draws the flow. Releasing over
empty canvas cancels, with no undo step. The handle-drag pattern is the one
the studio has today, kept by ruling.

Keyboard: with an element selected, a shortcut starts a flow from it, the
arrow keys or typing move the target choice across elements, and Enter
commits. The existing keyboard-only flow spec is the starting point.

A flow follows its element for the whole drag and never jumps at the drop
(#154).

## Threat panel

- Opens when exactly one element is selected, anchored to the right edge. If
  the selected element sits under it, the canvas pans so the element stays
  visible.
- Selection alone never moves focus into the panel, so arrowing across
  elements does not land in a form at every step. Enter on the selected
  element moves focus in. Escape closes the panel and returns focus to the
  element; Escape again clears the selection.
- A refused draft persists per element across selection changes and is
  restored when its element is selected again.
- With more than one element selected the panel shows a count and no fields.
- With nothing selected there is no panel, so the panel is the only surface
  for adding a threat.

## What this displaces

The file bar, the docked palette with its add-on-click buttons, the always
open panel, and the visible Undo button. Each slice that lands a section
above removes what that section replaces rather than restyling it.

## Second wave

Ordered, and not before the sections above have landed:

1. Freehand boundary curves: the drag path sampled into waypoints.
2. Quick-create on a connector released over empty canvas, as FigJam does:
   the element types are offered, the chosen one is placed at the release
   point, and the flow is drawn to it. It reuses the placement code and is
   named an alias of the toolbox, not a command of its own.

## Open sections

To be ruled, in this order:

1. The command surface beyond the tools: the full shortcut map, platform
   modifiers, and what the tooltip and the menu show.
2. States: the empty state before a file opens, the unsaved indicator in the
   tab title, the loss report, and refusals at a field.
3. The visual system: one token file for colour, spacing, and type, no
   literal colour in a component, severity distinguishable without colour.
4. Accessibility beyond the rules above: the axe audits at rest, with the
   panel open, and mid-drag, and the focus order across the overlays.

## Defaults the team lead took

Listed so ratification can reverse any of them in one line:

- The unsaved dot on the menu button, and the file name and loss report in
  the menu.
- The panel opens on selection but takes focus only on Enter.
- Drafts persist per element across selection changes.
- Undo and redo live in the menu and on shortcuts, with no visible button.
- Tool lock by double click, unlock by Escape.
- The keyboard connector route described under Connectors.
