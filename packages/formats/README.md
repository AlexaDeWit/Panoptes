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
`read` returns its own loss report naming the keys it stripped and an
incomplete schema announces itself rather than quietly shortening the file.

The interface is generic over that schema and carries it as a member, so the
contract cannot describe a codec without one, and a document one format read
is not a document another format can be asked to write.

One `LossReport` serves every path. Its entries name the entity, what did not
come through, and why: `unrepresentable`, `narrowed`, and `split` for what a
format cannot hold as the model holds it, `discarded-by-edit` for source
material an edited model no longer accounts for, and `undeclared` for a key a
read dropped. A report with no entries records no loss, and `renderLossReport`
turns a report into lines for a person, escaping what an imported id could
otherwise do to a line.

`read` returns Effect's `Either` with a package-owned `ReadFailure` on the
error channel, one variant per place a read stops: text the format's syntax
refuses, a document the wire schema refuses, and a mapping `parseModel`
refuses. The two schema variants carry the model package's `ParseIssue`, so
issues read the same way whichever boundary produced them. Nothing throws.
Imports no internal package but `@panoptes/model`.

The codecs themselves come next: Threat Dragon v2 JSON read (#27) and write
(#28).

Unit tests: `pnpm nx test @panoptes/formats`.
