# @panoptes/canvas

The drawing primitives a diagram is made of, shared by the interactive studio
and by headless rendering: one glyph component per element kind, the flow edge
and its path maths, the threat badges, the handle geometry, the text wrapping,
the box, circle and segment arithmetic label placement is settled with, and
one stylesheet. Everything is presentational and stateless, and every
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
badge), `edges` (a flow with its ends resolved to points and its label
placed), `unplaced` and `bounds`. Badges come from the whole model because a
threat names elements without naming a diagram.

Nodes come back with the boundaries first, so they sit behind what they
enclose, and painting `nodes` and then `edges` gives the right order: a flow
ends on the outline of the node it points at rather than under it. `bounds`
holds the ink that painting lays down: the outlines, a boundary curve's
cubics, the text inside and beside them, the badges hanging off their corners,
the flow lines with their arrowheads and names, and a free end belonging to no
node. Every part is measured with the function that draws that part,
`nodeTextPlacement`, `textPlacementCorners`, `badgeAnchor`, `badgeBox`,
`arrowheadPoints` and `controlPolygon`, and a flow's name and badge are read
off the placement the layout settled on that edge, so the picture and the box
around it cannot drift. A curve is bounded by the convex
hull of its control points, which holds the curve and a little more, because a
sharp turn throws a control point outside the box its waypoints span while the
ink stays inside the hull. `controlPolygon` is the one derivation of those
points, so the bounds, the flow-label search and the specs that check them
read the curve alike.

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

## The five rules the drawing follows

**Presentation is one stylesheet.** `canvasStylesheet` is the only styling
there is, and `canvasClassNames` is the typed map of every class it defines.
The primitives carry class names and never inline styles or CSS modules, so
the headless renderer embeds the one string in a `<style>` element inside its
SVG and the studio injects the same string once. A renamed class is a compile
error for every consumer, and the suite checks that the sheet and the
primitives name exactly the same set of classes. Interactive states join as
further classes in the same sheet. Every value in that sheet comes out of the
token module below rather than out of the sheet itself.

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
carries the number of open threats attached to the element over a mark for
the worst severity assessed among them, a letter per severity and a question
mark where none has been assessed, and it is coloured by that same severity.
The mark is what the badge says about severity; the tone repeats it, so the
picture reads with the colour ignored and the interactive canvas and the
headless render say the same thing. The secondary badge, smaller, neutral and
unmarked, since every threat it counts is undecided, carries how many of the
open threats those are, and appears only where that says something the
primary does not: an element whose open threats are all
undecided shows the primary alone, neutral. An element with no open threat
shows no badge.

**Glyphs are the ones Threat Dragon draws**, since the corpus round-trips
through that tool: an actor is a rectangle, a process the circle inscribed in
its box, a store a pair of horizontal lines open at the sides, each with the
element's name centred inside. A text element is its own prose wrapped inside
its box, with no outline or fill. A box trust boundary is a dashed rectangle
and a curve trust boundary a smooth dashed open curve through its waypoints,
Catmull-Rom converted to cubic segments, with its name beside the waypoint the
placement settles on. A flow is straight segments from its source through its
waypoints to its target, with a filled arrowhead at the target, and its name
and badge beside the line where `flowLabelPlacements` settled them. Each hangs
off a unit normal rather than straight down the y axis: a name at a standoff
plus its own extent projected onto that normal, a badge at the standoff plus
its own reach that way, which is not symmetric since a badge stacks its
secondary below its primary. So a vertical or diagonal flow carries its name
beside its line rather than along it, whatever the height of the block, a
curve carries its name clear of the dashes rather than under them, and a
flow's badge takes the other side of the line from its name. A flow name is
also stroked in the ground colour under `paint-order: stroke`, so names that
converge on one element read in layers rather than as one blot. An
out-of-scope element draws dimmed with a dashed outline; the reason it is out
of scope stays in the register.

A flow's normal is its own segment's. A curve's is the normal of the tangent
the drawn curve has at the waypoint its name hangs beside, the middle waypoint
unless the search below walks along the curve: the central waypoint of an odd
run and of an even run's two central ones the one nearer the origin, by x and
then by y, so the anchor is a waypoint on the curve and a reversed run anchors
the name on the same one. That tangent is the run from the waypoint before it
to the one after with the ends repeated where a neighbour is missing, and of
the two normals it takes the one pointing away from the bend, so the name sits
on the outside of the turn and the arms lead away from it. Where the bend lies
along the tangent, which a straight middle gives, and for a flow throughout,
the normal with a non-negative y is the run's own, and where that y is zero
the one with a positive x. The side is therefore fixed by the waypoints rather
than by which end the flow or the curve is drawn from, and it carries nothing
beyond that: which side of a divider its name sits on says nothing about which
side the name describes.

A curve's name is offered an ordered list of candidates and takes the first
one clear of the drawn curve, of the shape every element draws and of every
element's badge, since a name under a badge or over a glyph cannot be read:
the convex side of the middle waypoint, then its mirror, then both sides of
each further bend, walking outwards from the middle a waypoint at a time and
taking at each distance the bend nearer the origin first, by x and then by y.
Where no candidate is clear the convex side of the middle waypoint stands, a
name having to be drawn somewhere, and the collision it leaves is one the
suite reports rather than one the picture hides. Element names are not
consulted, and it is the flow labels that move aside around a curve's name,
since its text box is one of the obstacles that search reads. Every candidate
is fixed by the waypoints and the obstacles are the shapes the model's own
elements draw, so neither the order the model holds its elements in nor the
end the curve is drawn from changes the answer.

What the offset guarantees on either side of a bend is a standoff from the
tangent there. The outside of the turn carries that over to the drawn curve,
for every shape the suite draws or probes: arches, bowls, hairpins, S bends,
and the runs the fixtures hold. The mirror sits inside the turn, where the
arms lead back, and a tight arch's mirror crosses its own ink, so a candidate
is tested against the curve itself: `sampledCurve` takes a polyline through
the ink at a fixed count of points per cubic, rather than the control polygon,
which can pass outside a box the curve runs through. What is left uncaught is
a curve that doubled back over its own bend between two samples.

**Flow labels are placed where nothing else is drawn.** A flow's name printed
beside its own midpoint lands on another flow's line, inside an element, or on
top of another name often enough that the picture stops reading as a diagram,
so `layoutDiagram` settles every flow label over the whole diagram at once and
stores the result on the edge. `flowLabelPlacements` offers each flow the
midpoint and the quarter points of each of its segments, on either side of
that segment's normal, at three standoffs a clearance apart. A candidate
costs one for every element shape, element name and element badge its own name
or badge box overlaps, one for every straight run of a drawn line that meets
either box, and one for every name or badge already placed that either box
overlaps.

An element is charged as the shape its glyph draws, measured by the function
that draws it: an actor, a store and a text element as their boxes, a process
as the circle `processCircle` inscribes in its box. So a label in a corner of
a process's box costs nothing for that process, which is what a reader sees
there: white space beside a circle. The element occupies that shape, its run
of text and its badge, so a label over an element's name costs both; a trust
boundary occupies its outline alone, its four sides or the polygon its
curve's control points trace, since it encloses what it is drawn around and a
label inside it is where it belongs. The drawn lines are those outlines and
every flow's own polyline.

Every badge already drawn is grown by one clearance on every side where a
candidate's own badge box is tested against it, an element's and a flow
label's alike, so a flow badge that comes within a clearance of another badge
costs as much as one drawn over it: two circles that close together read as
one element's own stacked pair rather than as two labels. A candidate's name
box is tested against every badge as it is drawn, ungrown, since text beside
a badge is still read as text.

Flows are placed in ascending order of their ids, so the order the model holds
its elements in decides nothing, and a tie goes to the candidate nearest the
midpoint of the flow's longest segment, then to the flow's own placement
beside that midpoint, then to the first candidate in the order above. Nothing
is measured, so the interactive canvas and the headless render agree and a
golden holds byte for byte. Two flows between one pair of elements share a
segment and therefore a candidate list; the first by id takes its own side of
the line and the second is pushed to the other side by the name already there,
and where both carry a badge the growth pushes the second's badge off the
first's rather than letting the two stack a few units apart. A label with no
clear candidate anywhere takes the cheapest one rather than being dropped, so
a dense diagram still draws every name it carries.

## The visual system

`tokens.ts` is where a colour, a step of spacing and a size of type are
decided, for the diagram and for the studio's chrome alike. `lightPalette`
names roles rather than shades: the three surfaces, the two washes an actor
and a process are filled with, the two inks, the hairline, the ruled line of
the studio's graph paper, the primary action, the cream a badge is lettered
in, and one tone per severity. `darkPalette` answers the same roles over warm
ink grounds. Nothing applies the dark table yet, so it is data beside the
light one rather than a theme.

The palette is the maintainer's vintage draftsman colours with the lightness
moved where a contrast floor demanded it and the hue left alone. Six values
are not the starting palette's own, and the reasons are in the module. The
fifth severity, which the starting palette does not carry, is the olive of the
primary action, so a low badge and a button are one colour: what tells one
severity from another is the badge's mark, and the tone repeats it. The grid
line is the other role the starting palette has no value for, a warm taupe the
studio rules its canvas with.

`contrastRatio` is the WCAG 2.2 ratio computed from two tokens, and
`tokens.spec.ts` puts every text-on-surface and mark-on-surface pair of both
tables through it: 4.5 for text and for a badge's lettering, 3 for a mark and
for the outline that identifies a control. Every surface counts as a ground,
the two washes an actor and a process are filled with among them, since a
badge is drawn over an element as readily as beside one. So the palette is
measured rather than read, and a value moved by hand fails the suite with the
ratio it reached. `channelDistance` is the coarse floor under the five tones,
which catches two collapsing onto one shade and claims nothing more.

The grid line is measured on a band rather than against a floor, at least 1.3
and at most 1.6 on the canvas ground it is drawn over. Graph paper has to be
visible without reading as a control's outline, so a later edit that darkens
it to the hairline's 3 fails the suite as readily as one that loses it in the
ground.

The module carries the sizes the drawing is built from as well as its colours.
`strokeWidths` is every stroke a diagram lays down: one weight for an
element's outline, a trust boundary's dashes and a flow's line, a heavier one
for a store's two lines, which are the whole glyph and have no box to sit in,
and the ring and the halo that cut a badge and a flow name out of whatever
they are drawn over. `arrowhead` sizes the triangle a flow ends in,
`badgeRadius` the two circles a badge stacks, and `gridSpacing` the graph
paper the studio rules its canvas with, which the headless render lays down
none of. The badge radii and the ring are one decision: the ring is centred on
the circle, so half of it eats into the disc the count is lettered on, and the
secondary radius is 9 because a two-digit count at that size, measured with
the wrap's own ratio, reaches 6.69 units from the centre where a 3-unit ring
would leave 6.5.

`canvasStylesheet` resolves the light tokens to values, because the standalone
SVG has no document around it to hold a `:root` and neither has the PDF that
embeds those bytes. `tokenStylesheet` is the other projection of the same
table, a `:root` block of the `--pn-*` custom properties the studio's CSS
modules read, which the studio injects once at its own root
(`apps/studio/src/theme.tsx`). Generating a `.css` file at build time would
work as well and was not taken: a generated file is a second copy that a check
has to police, where a projection computed from the table cannot go stale.
That is why the studio's custom-property names live in this package: the
naming already followed the `pn-` prefix this sheet emits, and the projection
belongs beside the table it reads.

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
same function to text of their own, a title element for instance.

A wrap counts columns in grapheme clusters and breaks a long word between
them, never through a surrogate pair, since half a pair on each of two lines
is two lone surrogates and the same refusal arrived at after the replacement
has run, and never through a cluster, since a regional-indicator flag broken
across lines is two letters and a family joined by zero-width joiners is four
people. A cluster is settled by an explicit rule over code points rather than
by `Intl.Segmenter`, whose segmentation data moves with the runtime's ICU and
would move a golden on a Node bump: a combining mark, a variation selector
among them, an emoji skin tone modifier and a tag character all join what
precedes them, a zero-width joiner takes what follows it, and a pair of
regional indicators is one cluster, on its own or after a joiner. Tag
characters are what spell out a subdivision flag such as Scotland. Outside the
rule, and so still breaking, are a Hangul jamo sequence, a prepended
concatenation mark, an Indic conjunct joined through a virama, and the Thai
and Lao vowel signs U+0E33 and U+0EB3. A cluster counts as one column, so a
flag is as wide as a letter in the estimate.

## React Flow

`canvasNodeTypes` covers every node kind and `canvasEdgeTypes` covers the
flow. A node wrapper draws the shared glyph at the model's own width and
height and adds four `Handle` components. Every handle is of
type `source`, so the canvas that mounts them passes
`connectionMode={ConnectionMode.Loose}` for a flow to be able to end on one.
A selected node of a kind the model can resize adds one `NodeResizeControl`
at its bottom right corner, and nothing else: a control on the top or the
left moves the node as well as sizing it, which is two model operations for
one gesture, and a boundary curve carries none because the model has no
extent to set on one. The control reports through the node changes the canvas
already folds, so this package still dispatches nothing.
`toReactFlowNodes` carries the layout's nodes over with their position and
extent set explicitly, so React Flow measures nothing; a boundary curve rides
as a node too, sized to the box its waypoints span, so it drags and selects as
one thing. `toReactFlowEdges` carries the flows over the same way, each end
naming the element it attaches to and the handle side the layout resolved.

A React Flow edge runs between two nodes and a model flow may end at a free
position that is no element, so `freeEndNodes` gives such an end a node of its
own at that position, named by `flowEndNodeId` and drawn by
`CanvasFreeEndBody`, which draws nothing but the one handle React Flow needs
to resolve where the edge ends. The flow's own glyph carries the line all the
way to the free position, so the anchor lays down no ink the headless render
does not. It is not draggable, not selectable, not focusable, and hidden from
assistive technology: it is a place for an edge to end rather than a thing on
the diagram.

`CanvasEdgeBody` draws a flow from the geometry the layout resolved, with its
two ends anchored again to where React Flow has the nodes they attach to.
That is what lets a line follow an element under the pointer: React Flow
applies a drag frame to the node list and a canvas that keeps one undo entry
per gesture tells the store once, at the drop, so between the two the node's
live position is the only place the element's position is. The re-anchoring
is `reanchoredFlow`, and the edge reads a live node through React Flow's
`useInternalNode`, so a frame re-renders the moved node's own flows and no
others.

Issue #154 offered two shapes for that and this is the first of them, the
in-flight line drawn from where the ends are now, rather than the second,
a whole layout recomputed per frame. Two reasons. A layout settles every flow
label over the whole diagram, so a frame would cost work proportional to the
diagram rather than to the one node moving, which is the number issue #181
puts a floor under. And the anchors are cheap enough to settle exactly:
`reanchoredFlow` is `layoutDiagram`'s own arithmetic over the node's live box,
including which of the four handles each end takes, rather than the `sourceX`,
`sourceY`, `targetX` and `targetY` React Flow measures off the DOM. Nothing is
measured, the interactive and headless paths stay one, and a node back where
the model has it gives the settled anchor exactly, so the drop moves no line.

What the first shape gives up is the label and the badge, which keep the
placement the layout settled over the whole diagram and so stay where they
were until the drop settles them again. Nothing here reads what kind of
element a box belongs to, so a flow attached to a trust boundary follows that
boundary as it follows any other node. A free end is carried by nothing: the
model links an element to a boundary by where the two are drawn and by
nothing else, so a boundary dragged around a free end, or around any element,
moves neither.

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
