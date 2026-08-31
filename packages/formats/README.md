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
whole file, the X6 styling, ports, text blocks, and boundary bookkeeping
Panoptes does not model included. What it declares it demands, and it demands
nothing else, because it describes the file rather than the subset Panoptes
can represent: a threat's status, severity, category and methodology are text,
since Threat Dragon stores each label in the author's own locale, and a threat
number is optional, since most threats in Threat Dragon's own demo models
carry none. `version` accepts `2`, `2.x` and `2.x.y`, and a file from another
major is refused whole rather than read in part. A key the schema does not
declare is dropped and reported through `undeclaredDivergences`, the walk every
wire codec shares, so a schema that has fallen behind the format announces
itself.

A value with no home in the internal model therefore reaches the document
intact, and what the mapping then does with it is a separate question from
how the file is read. A category label is looked up in the language Threat
Dragon wrote it in before it is read, so a German file and an English one
describing the same threat reach the same category. A methodology the model
does not enumerate, an Elevation of Privilege card, and a label from a
language Threat Dragon has added since all become a custom category, and the
read reports what it holds less exactly than the file stated it. A threat the
file leaves unnumbered is issued the next number above the model's own mark.

The corpus in `test-data/threat-dragon` is the gate on all of this: every
threat model Threat Dragon ships in its own repository reads, with no key the
wire schema fails to declare.

The write codec (#28) and the format detection that picks a codec (#84) come
next.

Unit tests: `pnpm nx test @panoptes/formats`.
