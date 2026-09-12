# @saerskriven/render

Projections of a model. `renderSvg` draws one diagram as a standalone SVG
document, `renderRegister` writes the threat register as GFM markdown, shaped
to replace a register a downstream site generator builds by hand, and
`renderTypst` writes the whole model, every diagram and that same register, as
the source of one Typst document.

Every projection is a pure function of the model. The `pdf` subpath compiles
that Typst source into the bytes of a document, and it carries no font and
reads no file either: the WebAssembly module and the faces it typesets with
are the caller's to hand over. The `resvg` subpath draws one of those SVG
documents into the bytes of a PNG on the same terms, and the `png` subpath is
the projection over it, taking a diagram and a model where `resvg` takes a
document. The main entry loads none of it, so a caller that wants a drawing
or a register loads no compiler and no renderer.

## A diagram as an SVG document

`renderSvg(diagram, model)` lays the diagram out with `@saerskriven/canvas`,
draws the canvas primitives once through `renderToStaticMarkup`, and returns
the document as text beside the flow endpoints the layout could not place.
The studio will mount those same primitives in React Flow (M4), so what the
CLI writes and what a browser draws come out of one set of glyphs and one
path maths.

`width` and `height` beside them are the document's own size in user units,
which is what the `png` subpath scales to a pixel size.

The document holds an `svg` root in the SVG namespace, the diagram's title in
a `title` element, which is the accessible name a reader hears and the name a
browser puts on the tab, the canvas stylesheet verbatim inside a `style`
element, and the diagram's glyphs in painting order, and it ends in a newline
so the bytes are a text file. That stylesheet is the canvas package's resolved
one, every colour a value from the light table: the studio has an app root
carrying custom properties and follows the system colour scheme through them,
where these bytes have nothing around them to resolve a property against.
Nothing else is in it: no script, no external stylesheet, no font file, no
reference of any kind to anything outside the document. The bytes therefore
open on their own, embed in a PDF, and survive a content policy that forbids
fetching.

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
a name cannot cost a reader the whole picture. `@saerskriven/model` refuses
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

`registerDocument` builds that as an mdast tree and is the register's one
definition. `renderRegister` serializes the tree as markdown and
`renderTypst` walks it into Typst markup, so what a PDF says and what a
markdown file says cannot drift. `deepestProse` is the one bound both writers
observe.

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
  methodology added to `@saerskriven/model` stops this package compiling rather
  than rendering blank, and `markdown-register.labels.snapshot.txt` beside
  the spec pins the label text of every member the model declares, rendered
  rather than restated. A threat attached to no element reads `None`, prose
  a threat does not carry reads `None recorded.`, and a model holding no
  threats says so in place of an empty table.

## A model as a Typst document

`renderTypst(model)` returns the source of one document and, beside it, the
same `unplaced` list `renderSvg` reports, gathered over every diagram: the
projection covers every diagram at once, so a caller that draws none of them
itself still has the notice.

Every diagram comes first, one to a landscape page, then the register on
portrait pages. A diagram is embedded as the bytes of the SVG document
`renderSvg` writes, so the PDF and a standalone `.svg` file are the one
drawing. Nothing is referenced from outside the source: no file, no font
file, no Typst package, no URL. A compiler therefore needs no filesystem and
no network, which is what lets the `pdf` subpath run one with neither.

The source names the two font families it expects, Liberation Sans and
Liberation Mono, and carries neither. A compiler is given them, and
substitutes where it has neither. That substitution reaches the drawings
too: their stylesheet asks for Helvetica and Arial, which no compiler here
has, so the PDF and a standalone `.svg` file are the one drawing rather than
the one rendering of it. The source also carries no date, so a compiler that
is itself deterministic writes the same PDF twice.

### Typst markup is a language, and threat prose is untrusted

Typst is not a markup dialect that a stray character makes ugly. `#` calls a
function, and `*`, `_`, `` ` ``, `<`, `@`, `[`, `]` and `\` all mean
something, so a threat title reaching the source as markup would be a
`#read("/etc/passwd")` away from a document that reads a file. No value out of
the model is written as markup. Every one becomes a Typst string literal,
where only `"` and `\` have meaning and a C0 control becomes a `\u{}`
escape, and a literal shown in markup position displays the text it holds.
Every `#` in the output is therefore this package's own, which is what
`test-data/adversarial/typst-injection.yaml` is there to hold it to.

The register's prose is user-authored markdown, so the walk covers every node
type mdast can carry, checked by the compiler rather than by a default case.
Nothing is dropped, YAML frontmatter aside, which the register's parser is not
configured to produce. Raw HTML is written as its own text, exactly as the
markdown register writes it: dropping it deleted a mitigation an author wrote
in HTML with nothing said, and kept the text between the tags, so the document
asserted the author had written what was left. The Écluse fixture is the
proof that this is not a corner case: its prose names a configuration key
`mounts.<eco>.publicationTargetToken`, and `<eco>` parses as raw HTML.

A link is written as its own text with its address beside it in parentheses,
and never as a live link. Following a link out of untrusted prose from inside
an audit artifact is refused; writing the address means a reader loses nothing
by that. An image is written the same way, its alternative text and its
address, since nothing is fetched.

Prose nested past `deepestProse` is one paragraph of the author's own bytes,
there as here. That bound is the smaller of the two writers', and the smaller
is the Typst one, which is what keeps a register that renders as markdown from
failing to compile as a PDF. The blockquote is the construct that binds:
Typst refuses a document nesting its own show rules past sixteen, so
seventeen nested blockquotes are refused where twenty nested strong or
emphasis are not, and remark's serializer goes deeper than either. A tree of
n nested blockquotes measures n + 2, the paragraph and the text under the
innermost being the other two levels, so 18 is the exact bound and the 16 the
package sets is two levels under it. That margin is deliberate: the limit is
the compiler's rather than this package's, a Typst release may lower it, and
two levels buy a version bump without prose that has always rendered starting
to fail.

## Typst source as a PDF

`compilePdf(source, assets)`, on the `@saerskriven/render/pdf` subpath, is the
compile step: the bytes of a PDF, or a `PdfFailure` saying why there are
none. It sits on a subpath rather than the main entry because it pulls in 28
MB of WebAssembly, which a caller drawing an SVG or writing a register has no
use for.

`assets` is where the bytes come from, since this package holds none: `wasm`
is the Typst WebAssembly module, and `fonts` are the faces, added to the
compiler in the order they are listed. Nothing is read from a file and
nothing from the host's font directories. `apps/cli` reads them beside its
bundle. `apps/studio` fetches the same build-time assets before it calls this
subpath.

The Node-only `build-assets` subpath names that compiler module and the five
font files in compiler order. The CLI uses both. The studio imports the
module through Vite's asset URL handling and uses the shared font list.

The compiler is given no access model, so it has no filesystem and no package
registry. That is the other half of what `renderTypst` promises: the source
references nothing outside itself, so a compiler that can reach nothing is
enough to typeset it.

The compiler's JavaScript loads on the first call to `compilePdf`. A web build
can keep it in a separate chunk, while the CLI's single-file build inlines it.

The WebAssembly module starts asynchronously once per process. This avoids a
browser's size bound for synchronous compilation on the main thread. The
guard records the identity of each `wasm` array, and every call waits on the
first start. A second module cannot replace it.

Each call frees its compiler after compilation. A long-lived browser can
export repeatedly without retaining the compiler or its loaded fonts.

A refusal is a value rather than a throw, and a tagged one this package owns
([`CODING.md`](../../CODING.md), Error handling). `PdfFailure.Refused`
carries the compiler's sentences in the order it reported them, and
`PdfFailure.NoDocument` is the compiler answering with something that is not
bytes. Whoever calls words them: `apps/cli` joins the sentences with
semicolons into the one line a command prints.

Those sentences come out of a throw. The compiler reports a failure by
throwing a string holding Rust's own debug rendering of its diagnostics, of
which a reader needs the message and the hints. The byte offsets and empty
traces beside them are dropped, and a rendering this does not recognize is
carried as it stands rather than swallowed.

## An SVG document as a PNG

`rasterizeSvg(source, assets, longEdge)`, on the `@saerskriven/render/resvg`
subpath, is the rasterization step: the bytes of a PNG beside the pixel size it
drew at, or a `ResvgFailure` saying why there are none. It sits on a subpath
for the reason the `pdf` one does: it pulls in 2 MB of WebAssembly, which a
caller writing a register has no use for.

`assets` is where the bytes come from, since this package holds none: `wasm` is
the module `nix build .#resvg-wasm` writes out of the `resvg` crate, and
`fonts` are the faces, offered in the order they are listed. A family the
document names that no face carries falls back to the first face offered,
which is what puts a Liberation face behind the Helvetica and Arial the canvas
stylesheet asks for. Without that fallback the renderer draws no text at all.

A buffer holding no face the renderer reads is refused, named by its index,
rather than passed over. The font database drops a face it cannot parse
without a word, so a truncated file, a wrong file, or an empty one would
otherwise rasterize as a picture with no text in it, which is this package's
worst way to be wrong.

`longEdge` scales the drawing so its longer side is that many pixels, and 0
draws it at the size the document names. A long edge that is not a whole
number of pixels from 0 to 4294967295 is refused rather than truncated or
wrapped: a caller sizing a diagram is asking for that size, and the size it
would get instead is the document's own. An image past 67108864 pixels is
refused as well, because an allocation the module cannot satisfy aborts it
where a refusal it can report costs nothing.

The renderer reads no file. It is compiled for `wasm32-unknown-unknown`, which
has no syscall to reach one with, out of a crate built without the features
that read faces off a disk, and an `<image>` element naming a path resolves to
nothing rather than to a file the host holds.

Each call runs its own instance of the module, so the faces one call offers
reach no other. The compiled module is held per `wasm` array, so a second call
on the same bytes does not compile it again. An instance that stopped partway
is dropped rather than called again to free what it held: it is that call's
alone, and calling back into it would fail a second time over the failure
that reaches the caller.

A refusal is a value rather than a throw, and a tagged one this package owns
([`CODING.md`](../../CODING.md), Error handling). `ResvgFailure.Refused`
carries the sentence the renderer reported about the document it was given,
and `ResvgFailure.Unusable` the one a module that would not start reported.

The `build-assets` subpath names the variable a build reads the module's path
from and the name it is carried under beside a bundle. Its spec skips where
that variable is unset, since no dev shell exports it: `nix build
.#resvg-wasm` writes the module and the caller points the variable at it, as
[the repository README](../../README.md#the-svg-rasterizer) describes.

## A diagram as a PNG

`renderPng(diagram, model, options)`, on the `@saerskriven/render/png`
subpath, draws one diagram with `renderSvg` and rasterizes that document
through the `resvg` subpath, returning the bytes of a PNG file, its pixel
size, and the same `unplaced` list the drawing reports. It is here because MCP
hosts take an image block as PNG, JPEG, GIF or WebP and never as SVG, so an
agent that asks for a diagram cannot be handed the drawing itself.

`options.assets` is what `rasterizeSvg` needs, passed through: the module and
the faces. The faces are offered in the order given, and the first is the one
an unmatched family falls back to, which for these drawings is every family
they name. A caller therefore leads with the face it wants text drawn in, and
`apps/cli` leads with Liberation Sans, which is metrically compatible with the
Arial the canvas stylesheet asks for.

`options.longEdge` is the pixel length of the image's longer edge, whichever
that is, and it defaults to 1568, the size an MCP host downscales an image
block to. The aspect ratio is the drawing's own, so a diagram smaller than
that is drawn larger rather than placed in a field of background.

The raster carries a background the SVG document does not. `renderSvg` writes
the diagram and not the surface it was drawn on, and a renderer draws what it
is given onto transparency, so the picture is nested inside a document
carrying the canvas ground. Its colours are the light table, measured for
contrast against that ground, and a viewer filling transparency with its own
dark theme would put them on something else.

A refusal is a value, as it is for the PDF and for `rasterizeSvg` underneath:
the `ResvgFailure` comes back unchanged, and `apps/cli` words it into the one
line a command prints.

## The goldens

The files under [`test-data/render/`](../../test-data/render) are this
package's output, committed so a change to what it writes arrives as a diff
on a file rather than as a test that still passes:

- `ecluse.register.snapshot.md`, the Écluse model as a threat register.
- `saerskriven.register.snapshot.md`, the same of
  [Saerskriven's own threat model](../../threat-modelling/README.md), which
  carries what Écluse does not: a custom methodology, a CIA category, threats
  attached to no element, and a mitigation written as a markdown list.
- `ecluse.snapshot.svg`, the one diagram of the Écluse model.
- `every-glyph.snapshot.svg`, the diagram of
  `test-data/every-glyph.model.json`, drawing one of every glyph the canvas
  knows. Écluse carries no text element, no boundary curve, and no flow the
  layout refuses, so without it those would have no committed picture.
  `@saerskriven/canvas` draws the same model into a golden of its own, which is
  why the model sits under `test-data` rather than inside either package.
- `saerskriven-read-and-render.snapshot.svg` and
  `saerskriven-agent-and-desktop.snapshot.svg`, the two diagrams of the Saerskriven
  model, which is the only committed model holding more than one.
- One `<diagram>.snapshot.png` beside each of those four drawings, that same
  drawing rasterized.
- `ecluse.snapshot.typ`, the Écluse model as the Typst source of a whole
  document, which holds the diagram above inside it, so the two goldens move
  together.

The rasters are committed as pictures rather than as a digest of one. The
comparison is the bytes either way, so the gate is the same, and a review of a
changed raster is then a look at the two images side by side rather than two
hexadecimal strings that say only that something moved. What a comparison
cannot tell a reader is whether the new picture is the right one, which is why
it is committed in a form a reviewer can open.

Each list is one list in `src/goldens.fixtures.ts`, the drawings and their
rasters alike, so a further model or diagram joins every check over them by
being added there. The registers keep their own list in their own spec. The
suites compare every golden on every run and red where a file and the output
differ. Cached tests write no snapshot, so a missing golden fails. Regenerate
them with `pnpm snapshots:update @saerskriven/render` in the commit that moved
them, and read the diff. The raster goldens need
[`SAERSKRIVEN_RESVG_WASM`](../../README.md#the-svg-rasterizer) set, and their
suite skips where it is not.

The CLI's suites read several of them as fixtures, and the Saerskriven ones
use the model `@saerskriven/formats` maintains under `test-data`.

Unit tests: `pnpm nx test @saerskriven/render`.
