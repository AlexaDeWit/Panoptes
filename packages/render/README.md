# @panoptes/render

Projections of a model. `renderSvg` draws one diagram as a standalone SVG
document, and `renderRegister` writes the threat register as GFM markdown,
shaped to replace a register a downstream site generator builds by hand.

## A diagram as an SVG document

`renderSvg(diagram, model)` lays the diagram out with `@panoptes/canvas`,
draws the canvas primitives once through `renderToStaticMarkup`, and returns
the document as text beside the flow endpoints the layout could not place.
The studio will mount those same primitives in React Flow (M4), so what the
CLI writes and what a browser draws come out of one set of glyphs and one
path maths.

The document holds an `svg` root in the SVG namespace, the diagram's title in
a `title` element, which is the accessible name a reader hears and the name a
browser puts on the tab, the canvas stylesheet verbatim inside a `style`
element, and the diagram's glyphs in painting order, and it ends in a newline
so the bytes are a text file. Nothing else is in it: no script, no external
stylesheet, no font file, no reference of any kind to anything outside the
document. The bytes therefore open on their own, embed in a PDF, and survive
a content policy that forbids fetching.

The viewBox is the layout's bounds grown by a margin of 8 on every side, and
`width` and `height` are that box. The canvas measures those bounds over
everything a diagram draws, the text and badges that hang outside a node's
own box included, so the margin here is whitespace and the room a stroke
takes on the outside of the line it paints. It is not an allowance for a
label of unknown size: a flow name wrapping to four lines under a node used
to run past a fixed margin and rasterize cut off, which is why the extent is
the canvas's to report rather than this package's to guess.

A name, a title, and a note are free text, and a character XML 1.0 forbids
can reach one. Every run of text goes through the canvas's `xmlSafeText` on
its way into the document, the title element included, so one C0 control in
a name cannot cost a reader the whole picture. `@panoptes/model` refuses
those characters at its own parse boundary, so a model read from a file
carries none of them, and this replacement is the defence behind that one:
`parseModel` is the only gate the model has, the edit operations taking a
caller's strings as given, so a model assembled in memory reaches this
package with whatever its caller put in it. The spec builds its
forbidden-character model that way, spreading the text into a parsed model
rather than through a parse that would now refuse it.

The projection is per diagram: a model holding several is iterated by whoever
calls, since which diagram to draw is that caller's decision.

Ordering is the model's own. A diagram's element order decides painting order
and so decides the bytes, and moving an element in the file moves it in the
output. That is the design rather than a gap in it: the layout has no key to
sort by that the model does not already carry. Past that the output is a
function of the model alone, with no clock, no randomness, no locale, and no
generated id, so two runs write the same bytes.

`unplaced` is what the drawing left out. A flow endpoint may name any element
id the model holds, another flow's included, and a flow is drawn as no box,
so a flow ending on one is reported rather than given invented geometry. It
is absent from the markup and named in `unplaced`, and a caller that drops
that list drops the only notice of it.

## The threat register

The document opens on the model's title, then an overview table of every
threat (number, title, elements, category, severity, status), then one
section per threat carrying the same fields as a list and the threat's prose.
Threats come out in number order whatever order the model holds them in, and
the same model always renders the same bytes.

## What the register promises

- **Stable anchors.** A section heading is `Threat <number>: <title>`, so the
  anchor a renderer derives from it is a function of that threat alone. Threat
  numbers are issued once and never reissued, so adding, removing, or
  reordering threats moves no other threat's anchor. Line breaks in a title
  are collapsed to single spaces in the heading text alone, because an ATX
  heading holds one line: handed two, a serializer writes something else, and
  a title carrying a line that reads like another threat's heading would take
  that threat's anchor. Nothing links to those anchors from the overview
  table: the slug belongs to whatever renders the markdown, and spelling one
  here would bind the register to one renderer's rules.
- **Prose is markdown.** A threat's description and mitigation are parsed and
  spliced into the section as nodes, so a list or a table an author wrote
  stays one. A heading inside prose is demoted below the section heading, so
  it cannot break the register's structure. Raw HTML passes through as
  written: what to do about it belongs to whatever consumes the register.
  Prose nested deeper than 32 levels is rendered as one paragraph of the
  author's own bytes, because the serializer recurses per level and this
  package reports no failure and must not throw.
- **Escaping is the library's.** The tree is built out of mdast nodes and
  serialized by remark, never concatenated, so a title carrying a pipe, a
  backtick, or a leading hash lands in the table and the heading as that text
  and nothing else. Line breaks are the one thing a heading cannot carry, and
  they are collapsed rather than escaped.
- **Nothing goes missing.** An enum crosses to its display label through a
  table the compiler checks for totality, so a severity, status, or
  methodology added to `@panoptes/model` stops this package compiling rather
  than rendering blank, and `markdown-register.labels.txt` beside the spec
  pins the label text of every member the model declares, rendered rather
  than restated. A threat attached to no element reads `None`, prose a threat
  does not carry reads `None recorded.`, and a model holding no threats says
  so in place of an empty table.

## The goldens

Six files under [`test-data/render/`](../../test-data/render) are this
package's output, committed so a change to what it writes arrives as a diff
on a file rather than as a test that still passes:

- `ecluse.register.md`, the Écluse model as a threat register.
- `panoptes.register.md`, the same of
  [Panoptes' own threat model](../../threat-modelling/README.md), which
  carries what Écluse does not: a custom methodology, a CIA category, threats
  attached to no element, and a mitigation written as a markdown list.
- `ecluse.svg`, the one diagram of the Écluse model.
- `every-glyph.svg`, the diagram of `test-data/every-glyph.model.json`,
  drawing one of every glyph the canvas knows. Écluse carries no text
  element, no boundary curve, and no flow the layout refuses, so without it
  those would have no committed picture. `@panoptes/canvas` draws the same
  model into a golden of its own, which is why the model sits under
  `test-data` rather than inside either package.
- `panoptes-read-and-render.svg` and `panoptes-agent-and-desktop.svg`, the
  two diagrams of the Panoptes model, which is the only committed model
  holding more than one.

Each list is one list in the spec, the registers and the documents alike, so
a further model or diagram joins every check over them by being added there.
The suite compares all six on every run as vitest file snapshots and reds
where a file and the output differ. A deleted golden is a hole in that gate
rather than a failure: vitest writes a missing snapshot back and passes, and
only a CI run, where writing is refused, reports it. Regenerate them with
`pnpm nx test @panoptes/render -- -u` in the commit that moved them, and read
the diff.

Unit tests: `pnpm nx test @panoptes/render`.
