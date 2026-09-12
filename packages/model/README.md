# @saerskriven/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence, `emptyModel` being the one the package parses for you,
where a model that has not been drawn starts. Operations are pure functions
returning new models: graph edits (add, remove, move, resize, rename, edit Note
text), diagram edits (add, rename, remove), and register edits for threats
(add, remove, replace, attach, detach), mitigations and assumptions (add,
replace, remove, link, unlink, set status). A threat
number is issued once and never moves: the model carries the highest number it has ever
issued, so a removed threat leaves a permanent gap and `nextThreatNumber`
never hands its number back. Coverage queries read a model without changing
it: elements no threat references, open threats by severity, and the threat
count of every element. Fallible exports return Effect's `Either`, carrying a
package-owned `_tag`-discriminated failure on the error channel; an
infallible operation returns its result bare. No export throws to report a
failure, and zod stays behind the parse boundary on the terms
[`CODING.md`](../../CODING.md) sets. Imports no internal package.

Every string the model holds is text of a defined character set: every
letter, mark, number, punctuation, symbol and space separator Unicode
defines, plus tab, line feed and carriage return, plus the format characters
a script owns. That last part is a rule rather than a list, Unicode saying
which script a format character belongs to: the Arabic number signs and
letter mark, the Syriac abbreviation mark, the Mongolian vowel separator,
the Kaithi and Egyptian hieroglyph format controls and their kin all pass,
and so do the zero width non-joiner and joiner and the Arabic marks U+0605,
U+06DD and U+08E2, which Arabic writes although Unicode files them as
belonging to no script. What no script owns is refused: the bidirectional
controls, the zero width space, the word joiner, the byte order mark, the
invisible operators and the tag characters, so a subdivision flag built from
tags is refused where every other emoji sequence is not. It is an allowlist
rather than a list of what to block, which is what keeps every living script
readable, and [`SCHEMA.md`](SCHEMA.md) states it in full.

Which format characters that rule reaches depends on the Unicode data the
runtime carries, so
[`src/lib/text.format-characters.snapshot.txt`](src/lib/text.format-characters.snapshot.txt)
pins the set. The suite walks every Cf code point the runtime knows and
writes the accepted ones there as a file snapshot, so a Node or ICU upgrade
that moves the set arrives as a diff on that file rather than as a silent
change, and the diff is a question to answer: a character an upgrade gives a
script is a widening to keep, and one that leaves is a refusal of text a
model in the wild may already hold.

A control character or a bidirectional override from a foreign file is
refused at the parse boundary, with a path to the field that carried it,
rather than reaching a diagram. `firstRefusedCharacter` gives the index of
the first character a string carries that the rule refuses, so an editor can
point at it rather than at the field alone.

`parseModel` is the whole of that gate for a foreign file. `renameElement`,
`editNote`, `addDiagram` and `renameDiagram` screen the strings that an
editor commits after parsing. The other
edit operations take a caller's strings as given, a model assembled in memory
being the caller's to assemble. A boundary that renders a model escapes or
replaces what its output format forbids instead of resting on this rule.

Element variants hold optional security facts and declared boundary relationships.
Their fields and absence semantics follow [the native format](../../docs/saerskriven-yaml.md#security-facts).
Consumers query typed element properties directly. `setElementProperties` accepts
an `ElementProperties` patch for the existing kind. Omitted keys keep their values,
and keys explicitly set to `undefined` clear them. The operation validates text
and relationship targets, preserves unrelated fields, and returns the same model
when the patch changes nothing. An absent boolean remains unknown,
and an absent relationship list remains unrecorded. Geometry edits do not change these facts.

The suite carries a representability gate over the whole model vocabulary.
`ecluseFixture` transcribes Écluse's real Threat Dragon model, one diagram of
38 elements and a register of 29 threats numbered with the gaps the source
carries, into the internal form; `vocabularyComplementFixture` covers what
that model never reaches. Together they must span every element kind,
boundary shape, endpoint kind, threat status, severity, mitigation status,
and assumption status the schemas declare, and every category of every
enumerated methodology, so a construct that stops being representable fails a
named assertion or the type-check. The source file is vendored at
[`test-data/ecluse.json`](../../test-data/ecluse.json), and the suite holds
`ecluseFixture` against
[`test-data/ecluse.model.json`](../../test-data/ecluse.model.json) as a file
snapshot, which is where `packages/formats` compares its own read of the same
threat model against this one. Regenerate it with
`pnpm snapshots:update @saerskriven/model` in the commit that moved it.
[`test-data/README.md`](../../test-data/README.md) says when the snapshot is
written. Cached tests only read its committed bytes.

`@saerskriven/model/fixtures` is the one home for the fixture helpers every
suite in the workspace shares: `elementId`, `diagramId`, `threatId`,
`mitigationId` and `assumptionId`, which
parse a spec's literal string into a branded id, `modelInputArbitrary`, the
fast-check generator of `parseModel` input the property specs draw models
from, and `parsedFixture`, the
fold from a fixture document to a `Model` that throws where the fixture stops
parsing, a fixture that no longer parses being a broken suite rather than a
case under test. The subpath resolves to source and stays out of the library
build. Who may import it is a workspace rule, stated in
[`CODING.md`](../../CODING.md#tests).

[`SCHEMA.md`](SCHEMA.md) is the whole model expanded from the schemas
themselves, regenerated and checked on every test run.

Unit tests: `pnpm nx test @saerskriven/model`.

`selectionFragment` copies a selection, closes its attached flow endpoints,
and restricts related record links and declared boundary relationships to the copied graph. `remapFragment` gives
every record a caller-supplied fresh prefix and translates its geometry.
`insertFragment` validates the combined graph before returning it and issues
new threat numbers. An ID collision refuses the entire insertion.

`reconnectFlow` changes one endpoint to an actor, process, or store in the
same diagram, the element it already names included, and pins the end to a
side of that element where the caller names one or releases it to the
renderer's choice where none is named. It refuses an endpoint that would
connect the node to itself. The remaining flow fields and threat links keep
their values.

`setFlowDirection` makes a flow bidirectional or one-way. A bidirectional flow
keeps its source and target and is drawn with an arrowhead at each end.

`setFlowWaypoints` replaces one flow's ordered intermediate points. It
preserves the endpoints and metadata, rejects another element kind, and
returns the same model for an unchanged list. The studio uses that identity
to leave history and dirty state unchanged for a route with no edits.

`removeDiagram` drops a diagram that owns no element and refuses one that
still does, naming how many it holds. The refusal is deliberate: a cascade
would delete records the caller never named, which no other operation here
does. A caller that wants the cascade removes the elements with
`removeElement` first, which detaches the flows anchored to each and drops
its threat, assumption and boundary references, and then removes the emptied diagram.

A mitigation or an assumption only has meaning on a threat, and one record
can link many threats. The links live on the record, and a threat carries
no link back. `addMitigation` and `addAssumption` refuse a record linked to
no threat with `RecordWithoutThreat`. `linkMitigation`, `unlinkMitigation`,
`setMitigationStatus` and their assumption equivalents edit one record, and
a link that is already there, an unlink of a link that is not, or the status
a record already has return the model they were given. A replace is
whole-record replacement, as editing a threat is, and refuses a threat or
element id that names nothing.

Culling is edit-triggered. `removeThreat`, an unlink, and a replace that
take a record from one or more threat links to none remove the record in
the same operation, so one undo step restores both. An assumption's element
links do not keep it. A record that already had no threat link, which a
file can hold, stays through a replace or a status change, and `parseModel`
keeps it. `removeMitigation` and `removeAssumption` are explicit removals,
not culls. `droppedRecords` names the records one model holds and another
does not, which is how a caller reports what an edit culled.

`threatFlags` derives the flags a threat's records raise, as
`threatFlagSchema` values: `mitigated-without-implemented-work` for a
`mitigated` threat with no linked mitigation `implemented` or `verified`, and
`rests-on-invalidated-assumption` for a threat with a linked `invalidated`
assumption. Flags are never stored and never change a threat's status.

`autoPlacement` gives the position for the element at an index in a run the
caller has no geometry for: a row-major grid of four columns from a fixed
margin. The OTM and TM-BOM mappings in `@saerskriven/formats` place a record
whose source file carries no geometry with it, and it is exported for any
other caller that has to choose a position rather than read one.
