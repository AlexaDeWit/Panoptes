# @panoptes/render

Projections of a model. `renderRegister` is the first: the threat register as
GFM markdown, shaped to replace a register a downstream site generator builds
by hand.

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

## The golden register

[`test-data/render/ecluse.register.md`](../../test-data/render/ecluse.register.md)
is the Écluse model rendered by this package, committed so a change to the
output arrives as a diff on a file rather than as a test that still passes.
The suite compares it on every run as a vitest file snapshot and reds where
the two differ. A deleted golden is a hole in that gate rather than a
failure: vitest writes a missing snapshot back and passes, and only a CI run,
where writing is refused, reports it. Regenerate it with
`pnpm nx test @panoptes/render -- -u` in the commit that moved it, and read
the diff.

Unit tests: `pnpm nx test @panoptes/render`.
