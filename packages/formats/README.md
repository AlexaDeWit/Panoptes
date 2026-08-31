# @panoptes/formats

The codec contract for Panoptes' file formats. `Codec` is one interface over
two paths. `read` returns the internal model together with the wire document
it was mapped from. `write` takes that document back as an option: given one
it merges onto it, so what the model does not describe stays as the file had
it; given none it projects the model into the format's canonical form.

A format is adopted completely or not at all. Its wire schema declares
everything the format carries, the parts Panoptes does not model included,
because that completeness is what preserves them: a merge leaves untouched
what it does not map, and only a declared key is there to leave alone. The
schema is demanding about what it declares and drops what it does not, so
`read` returns divergences of its own naming the keys it stripped, and an
incomplete schema announces itself rather than quietly shortening the file.

The interface is generic over that schema and carries it as a member, so the
contract cannot describe a codec without one, and `write` accepts only a
document its own schema describes.

A divergence is any place a file and the model do not correspond exactly, or
a written file and the source it was merged onto, and one list of them serves
every path. Each entry names the entity, what did not correspond, and why:
`unrepresentable` for what the format cannot express, `undeclared` for a key a
read dropped, `narrowed` for a value reduced to fit, `split` for one record
the format forces into several, `overridden` for a value the codec wrote over
rather than repeated, and `discarded-by-edit` for what an edit removed from
the file. An empty list is the aligned case, and `renderDivergences` turns the
list into lines for a person, escaping what an imported id could otherwise do
to a line.

`read` returns Effect's `Either` with a package-owned `ReadFailure` on the
error channel, one variant per place a read stops: text the format's syntax
refuses, a document the wire schema refuses, and a mapping `parseModel`
refuses. The two schema variants carry the model package's `ParseIssue`, so
issues read the same way whichever boundary produced them. Nothing throws.
Imports no internal package but `@panoptes/model`.

`readThreatDragon` is the Threat Dragon v2 read. Its wire schema declares the
whole file, the X6 styling, ports, and boundary bookkeeping Panoptes does not
model included. It accepts any `2.x.y` stamp and refuses anything else
outright rather than reading part of it, and a key it does not declare is
dropped and reported through `undeclaredDivergences`, the walk every wire
codec shares. Threat Dragon's status, severity, and per-methodology category
vocabularies are bounded unions, and the tables that carry them onto the
model's own are total over those unions, so a value Threat Dragon adds is a
compile error rather than a runtime surprise.

Two things Threat Dragon 2.6 writes have no home in the model, and a file
carrying either is refused rather than read in part: `td-text-block` cells,
whose `tm.Text` annotation is not an element, and `EOP` threats, which name a
playing card rather than a category.

The write codec (#28) and the format detection that picks a codec (#84) come
next.

Unit tests: `pnpm nx test @panoptes/formats`.
