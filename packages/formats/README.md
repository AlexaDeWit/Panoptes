# @panoptes/formats

The codec contract for Panoptes' file formats. `Codec` is one interface over
two paths. `read` returns the internal model together with the wire document
it was mapped from. `write` takes that document back as an option: given one
it merges onto it, which is how fields Panoptes does not model (Threat
Dragon's ports, styling, and z-order among them) can reach the output at all;
given none it projects the model into the format's canonical form.

What `read` hands back is the raw parsed document, not the wire schema's
output, so a field the schema never declared is still there to write back.
`WireDocument` is the value space JSON and YAML both parse into, and it lives
here rather than in the model package, which stays the format-independent
authority.

The interface is generic over the format's own zod schema and carries it as a
member, so the contract cannot describe a codec without one. That schema
works inside `read`: typed access to the document, the paths a wire-document
failure reports, and the mapping into the model. Two obligations on it are
the codec's to keep, since the types do not carry them. It stays tolerant of
keys it does not declare, because a strict wire schema stops reading a file
the first time the other tool adds a field. And it neither transforms nor
coerces a value it round-trips, or the retained document and the mapped model
disagree about what the file said.

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
