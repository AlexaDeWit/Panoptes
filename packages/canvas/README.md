# @panoptes/canvas

The drawing primitives a diagram is made of, shared by the interactive studio
and by headless rendering: one glyph component per element kind, the flow edge
and its path maths, the threat badges, the handle geometry, the text wrapping,
and one stylesheet. Everything is presentational and stateless, and every
number it draws comes out of the model. Imports `@panoptes/model` and no other
internal package.

React Flow renders a node as positioned HTML rather than as part of one SVG
document, so the shareable layer is not the canvas but the pieces inside it.
`packages/render` composes these primitives into a standalone SVG and the
interactive canvas wraps the same ones in React Flow nodes and edges, so
geometry, glyphs and paths cannot drift between what a browser shows and what
the CLI writes.

## Laying a diagram out

`layoutDiagram(diagram, model)` turns one diagram plus the whole model into
the props every primitive needs: `nodes` (an element as a box, with its
badge), `edges` (a flow with its ends resolved to points), `unplaced` and
`bounds`. Badges come from the whole model because a threat names elements
without naming a diagram.

Nodes come back with the boundaries first, so they sit behind what they
enclose, and painting `nodes` and then `edges` gives the right order: a flow
ends on the outline of the node it points at rather than under it. `bounds`
holds the ink that painting lays down: the outlines, a boundary curve's
cubics, the text inside and beside them, the badges hanging off their corners,
the flow lines with their arrowheads and names, and a free end belonging to no
node. Every part is measured with the function that draws that part,
`nodeTextPlacement`, `flowLabelPlacement`, `textPlacementCorners`,
`badgeAnchor`, `badgeExtent`, `arrowheadPoints` and `smoothSegments`, so the
picture and the box around it cannot drift. A curve is bounded by the convex
hull of its control points, which holds the curve and a little more, because a
sharp turn throws a control point outside the box its waypoints span while the
ink stays inside the hull.

Stroke widths are the one thing outside `bounds`, since a stroke straddles the
line it paints, so a caller sizing a viewBox leaves whitespace for them. It
leaves nothing else. `bounds` covered the geometry alone until #31 and covers
the ink now, which is the same type carrying a different promise: a consumer
that padded it for badges and labels pads what is already counted.

A glyph draws its outline, then its run of text where `nodeTextPlacement` puts
it, then its badge, and it draws in its own coordinates, its origin at the
element's position, because React Flow places a node itself.
`PlacedElementGlyph` translates one to its model position and `DiagramGlyphs`
does that for a whole layout, in painting order, with no root element of its
own. The `<svg>` around it, its viewBox and the `<style>` inside it belong to
whoever composes the document.

A boundary curve is the one element the model gives no box. The layout derives
one, the span of its waypoints grown by the stroke width on every side, so the
stroke falls inside the node and a straight run, or a pair of repeated
waypoints, still has an extent to pick.

## The four rules the drawing follows

**Presentation is one stylesheet.** `canvasStylesheet` is the only styling
there is, and `canvasClassNames` is the typed map of every class it defines.
The primitives carry class names and never inline styles or CSS modules, so
the headless renderer embeds the one string in a `<style>` element inside its
SVG and the studio injects the same string once. A renamed class is a compile
error for every consumer, and the suite checks that the sheet and the
primitives name exactly the same set of classes. Interactive states join as
further classes in the same sheet.

**Attachment is fixed side-midpoint handles.** Every element the canvas draws
as a box exposes four handles, `top`, `right`, `bottom` and `left`, at the
midpoints of its sides, computed from the model's position and size. An
attached flow end takes the side whose midpoint lies nearest its next point:
the first waypoint for a source, the last for a target, or the other end's
centre where the flow has no waypoints. Ties break in the order top, right,
bottom, left. A free end stays at its own position. Two costs come with this
and are accepted: a flow can change sides when a waypoint moves, and several
flows can meet at one midpoint.

**Badges count open threats only**, on the model's own definition of open, so
a badge, the register and the CLI count one set of threats. The primary badge
carries the number of open threats attached to the element, coloured by the
worst severity assessed among them. The secondary badge, smaller and neutral,
carries how many of those are undecided, and appears only where that says
something the primary does not: an element whose open threats are all
undecided shows the primary alone, neutral. An element with no open threat
shows no badge.

**Glyphs are the ones Threat Dragon draws**, since the corpus round-trips
through that tool: an actor is a rectangle, a process the circle inscribed in
its box, a store a pair of horizontal lines open at the sides, each with the
element's name centred inside. A text element is its own prose wrapped inside
its box, with no outline or fill. A box trust boundary is a dashed rectangle
and a curve trust boundary a smooth dashed open curve through its waypoints,
Catmull-Rom converted to cubic segments. A flow is straight segments from its
source through its waypoints to its target, with a filled arrowhead at the
target, its name beside the midpoint of its longest segment and its badge on
the other side of the line. Both are offset along that segment's own unit
normal rather than down the y axis, by a stated clearance plus their own
extent projected onto that normal, so a vertical or diagonal flow carries its
name beside its line rather than along it, whatever the height of the block.
Of the two normals the one with a non-negative y is taken, and where that y is
zero the one with a positive x, so the side a name takes is fixed by the
segment and not by which end the flow runs from. A flow name is also stroked
in the ground colour under `paint-order: stroke`, so names that converge on
one element read in layers rather than as one blot. An out-of-scope element
draws dimmed with a dashed outline; the reason it is out of scope stays in the
register.

## Measuring nothing, and the same bytes every time

Nothing reads a glyph's extent back out of a layout engine: `getBBox`,
`getComputedTextLength`, `measureText` and `getBoundingClientRect` appear
nowhere, and a spec walks the package to check it. Text wraps by one stated
ratio of average glyph width to font size, so headless and interactive output
wrap alike. A primitive names a run of text through `wrappedTextStyles`, one
table carrying both the class name and the font size, and the stylesheet's own
font sizes are read from that table, so the size the wrap estimates with is
the size the text renders at by construction rather than by a pair kept in
step at four call sites. Every number reaching an SVG attribute goes through
`svgNumber`, which is locale-free, of fixed precision, and free of exponents
at every magnitude, so one model gives one set of bytes on every run and
platform. The suite pins that with a golden file per scene: the Écluse model,
`test-data/every-glyph.model.json`, the model that draws one of everything,
and each of the two diagrams of
[Panoptes' own threat model](../../threat-modelling/README.md). The
every-glyph model lives beside Écluse because `packages/render` draws it too
and the layer matrix allows no package dependency between the two readers.
`scene.spec.tsx` holds the scenes as one list, so a further one joins every
check in it by being added there.

A name, a title and a note are free text the model takes as it finds it, and a
file written elsewhere can carry a character XML 1.0 forbids: a C0 control
other than tab, newline or carriage return, an unpaired surrogate, U+FFFE or
U+FFFF. A document holding one is refused whole by every XML parser rather
than drawn with a gap, so `wrapText` puts every run of text through
`xmlSafeText`, which replaces each of them with U+FFFD. Replacing rather than
dropping keeps the character count, so the wrap that was estimated is the wrap
that is drawn. Whoever composes a document around these glyphs applies the
same function to text of their own, a title element for instance. A wrap
counts columns in code points and breaks a long word between them, never
through a surrogate pair, since half a pair on each of two lines is two lone
surrogates and the same refusal arrived at after the replacement has run.

## React Flow

`canvasNodeTypes` covers every node kind and `canvasEdgeTypes` covers the
flow. A node wrapper draws the shared glyph at the model's own width and
height and adds four `Handle` components, nothing else. Every handle is of
type `source`, so the canvas that mounts them passes
`connectionMode={ConnectionMode.Loose}` for a flow to be able to end on one.
`toReactFlowNodes` carries the layout's nodes over with their position and
extent set explicitly, so React Flow measures nothing; a boundary curve rides
as a node too, sized to the box its waypoints span, so it drags and selects as
one thing. Flows are left out of that conversion on purpose: a React Flow edge
runs between two nodes, and a model flow may end at a free position that is no
node, so how a free end rides is the interactive canvas's decision.

`CanvasEdgeBody` draws a flow from the geometry the layout resolved, not from
the `sourceX`, `sourceY`, `targetX` and `targetY` React Flow measures, which
is what keeps the interactive and headless paths together. The consequence for
the interactive canvas is that dragging a node moves no flow on its own: a
canvas that lets nodes move re-runs `layoutDiagram` on the changed model and
hands the edges down again.

A canvas mounting React Flow also loads React Flow's own stylesheet,
`@xyflow/react/dist/style.css`, beside `canvasStylesheet`. That is not a
second stylesheet for the primitives: it styles the container, the viewport,
the handles and the controls, none of which any primitive draws, so the one
sheet that owns the glyphs is still this package's.

`layoutDiagram` reports, rather than draws, a flow end that names an element
the canvas draws as no box. The model allows an endpoint to name any element
id, another flow's included, so a flow with such an end is left out of the
layout and named in `unplaced` instead of being given invented geometry.

Unit tests: `pnpm nx test @panoptes/canvas`.
