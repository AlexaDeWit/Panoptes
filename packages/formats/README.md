# @panoptes/formats

The codec contract for Panoptes' file formats. `Codec` is one interface over
two paths. `read` returns the internal model together with the wire document
it was mapped from. `write` takes that document back as an option: given one
it merges onto it, which is how fields Panoptes does not model (Threat
Dragon's ports, styling, and z-order among them) can reach the output at all;
given none it projects the model into the format's canonical form. The
retained document stays in this package, so the model package holds no
format's shape.

The interface is generic over the format's own zod schema, carries that
schema as a member, and infers the document types from it, so a codec cannot
offer a read path whose document type stands free of a schema it holds.

Both write paths report through one `LossReport`. Its entries name the
entity, what was dropped, and why: `unrepresentable` and `narrowed` for what
a format cannot hold, `discarded-by-edit` for source material an edited model
no longer accounts for. A report with no entries records no loss, and
`renderLossReport` turns a report into lines for a person.

`read` returns Effect's `Either` with a package-owned `ReadFailure` on the
error channel, one variant per place a read stops: text the format's syntax
refuses, a document the wire schema refuses, and a mapping `parseModel`
refuses. The two schema variants carry the model package's `ParseIssue`, so
issues read the same way whichever boundary produced them. Nothing throws.
Imports no internal package but `@panoptes/model`.

The codecs themselves come next: Threat Dragon v2 JSON read (#27) and write
(#28).

Unit tests: `pnpm nx test @panoptes/formats`.
