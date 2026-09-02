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
does not enumerate becomes a custom category carrying Threat Dragon's own
names unchanged, which is the model's escape hatch working rather than a
loss, so nothing is reported for it. Two things are reported, because the
model does hold them less exactly than the file stated them: an Elevation of
Privilege card, of which only the suit has a home, and a label from a
language Threat Dragon has added since this codec read its translations. A
threat the file leaves unnumbered is issued the next number above the model's
own mark.

Two corpora under `test-data/threat-dragon` gate this, each a different part
of it. The twelve threat models Threat Dragon ships in its own v2 format all
read, with no key undeclared and no value narrowed, which is the gate on the
wire schema being complete. The label tables it ships in sixteen languages
are the gate on the recovery above, which those models cannot exercise: every
one of them is written in English.

`readPanoptesYaml` and `writePanoptesYaml` are the Panoptes YAML format,
version 1, paired as `panoptesYamlCodec`. It is the native format: it holds
the whole model, so a read maps nothing away, a write leaves nothing out, and
both report an empty divergence list on every valid file.
[`docs/panoptes-yaml.md`](../../docs/panoptes-yaml.md) describes the file
itself.

The format is declared by [`@panoptes/wire-panoptes-yaml`](../wire-panoptes-yaml/README.md),
which imports zod and nothing else. A file is a contract with people who
already have one and the model is ours to change, so the two are separate
declarations that happen to say the same thing today, and this package is the
only one that knows both. The mapping is written out record by record in both
directions, and every vocabulary crosses through the tables in
`panoptes-yaml-vocabulary.ts`, each annotated with the whole `Record` of the
side it reads: a member added to either vocabulary is a compile error in the
mapping. Ids cross as the plain strings a file holds and are branded by
`parseModel`, the same way the Threat Dragon read hands them over.

`formatVersion` is a zod literal, so a file stamped with anything else fails
at that path rather than reaching the mapping, which is what will let the
detection layer tell a Panoptes file from a JSON one without the extension.
Within version 1 a key the schema does not declare is dropped and reported
through `undeclaredDivergences`, the same walk the Threat Dragon read uses,
so a file from a later release still reads.

Two writes of one model are byte-identical, which is what makes a model file
in git worth diffing. `canonicalOrder` puts each object's keys in the order
its schema declares them, with the tag of a tagged union first; threats are
written in number order, a number being unique and never reissued; and no
line is wrapped, so an edited sentence changes its own line rather than
reflowing the paragraph. Every other list keeps the model's order. `write`
takes the contract's source document and cannot be changed by it: there is
nothing for a merge to preserve when the format holds the whole model.

The Écluse model written as YAML is committed at
`test-data/panoptes/ecluse.yaml` and compared byte for byte on every run, so
a change to what the format writes arrives as a diff on that file. Models
generated over the model's own shape gate the rest: each survives a write
and a read as itself, with its threats in number order.

`writeThreatDragon` is the other half. Given the document a read returned it
merges the model onto it, and given none it projects the model into Threat
Dragon's own canonical form. Output is built through the wire schema's
inferred types, so the writer cannot emit a shape that schema would refuse,
and the path down to a threat, which Threat Dragon nests eight levels deep at
`detail.diagrams[i].cells[j].data.threats[k]`, is walked with the typed
helpers in `threat-dragon-document.ts` rather than with casts.

The merge writes over the mapped fields and leaves the document otherwise as
it found it, which is how ports, `attrs` styling, `zIndex`, `tools`, and the
per-type flags Panoptes does not model survive a save. A mapped field is
rewritten only where what the source says no longer reads back as what the
model says, because the mapping is not injective in two places the corpus
holds: Threat Dragon stores a category as the label its author saw, so a
German file says `Manipulation` where an English one says `Tampering`, and it
reads both `TBD` and `TBA` as the one undecided severity. Overwriting either
would record a user's edit where the read merely normalized.

Three decisions the codec makes on its own, each reported as `overridden`
where the source said otherwise. It stamps the release it models, 2.6.2,
rather than repeating the one the file arrived with. It raises
`detail.threatTop` to cover a number it wrote that the file did not already
carry, so Threat Dragon issues no number twice, and never lowers it: the mark
is what keeps the gap a removed threat left from being handed out again.
`detail.diagramTop` follows the same rule for a diagram number. Issuing a
number is not itself a divergence, since the file gains a fact rather than
losing one.

What the format cannot hold is named rather than dropped in silence: a
mitigation or an assumption, which Threat Dragon keeps no record of; a threat
attached to a trust boundary or a note, which it nests threats under neither;
a note's name, which it holds one text for; an out-of-scope marking on a
boundary or a note; a PLOT4ai category, since Threat Dragon ships an older
eight-category set that names something else; and a diagram the model named
rather than numbered. A threat attached to several elements is written under
each and reported as `split`. Where a merge meets a document an edit has
moved out from under, the diagram, cell, or threat that went is reported as
`discarded-by-edit` with what it was carrying.

Three oracles gate the write, all of them over the vendored corpus rather
than over invented input. Every file is written straight back onto its own
document and compared raw parsed input against raw parsed output: no scalar
moves but the stamps above, and each one that moves is matched by the
divergence that claims it. On `ecluse.json`, which is already stamped 2.6.2
and already numbers every threat, nothing moves at all and nothing is
reported. Every file then reads back as the model it was written from, and
`ecluse.json` reads back as the internal model vendored at
`test-data/ecluse.model.json`, which `packages/model` regenerates from its own
fixture. And every written file validates against the JSON Schema Threat
Dragon validates with, run through ajv as that tool runs it, so a file this
codec writes is loadable by the tool that owns the format.

The format detection that picks a codec (#84) comes next.

Unit tests: `pnpm nx test @panoptes/formats`.
