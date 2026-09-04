# @panoptes/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence, `emptyModel` being the one the package parses for you,
where a model that has not been drawn starts. Operations are pure functions
returning new models: graph edits (add, remove, move, resize) and threat
register edits (add, remove, replace, attach, detach). A threat number is
issued once and never moves: the model carries the highest number it has ever
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
[`src/lib/text.format-characters.txt`](src/lib/text.format-characters.txt)
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

`parseModel` is the whole of that gate. The edit operations take a caller's
strings as given, a model assembled in memory being the caller's to assemble,
so a boundary that renders a model escapes or replaces what its own output
format forbids rather than resting on this rule.

The suite carries a representability gate over the whole model vocabulary.
`ecluseFixture` transcribes Écluse's real Threat Dragon model, one diagram of
38 elements and a register of 29 threats numbered with the gaps the source
carries, into the internal form; `vocabularyComplementFixture` covers what
that model never reaches. Together they must span every element kind,
boundary shape, endpoint kind, threat status, severity, mitigation status,
and assumption status the schemas declare, and every category of every
enumerated methodology, so a construct that stops being representable fails a
named assertion or the type-check. The source file is vendored at
[`test-data/ecluse.json`](../../test-data/ecluse.json), and the suite writes
`ecluseFixture` back out to
[`test-data/ecluse.model.json`](../../test-data/ecluse.model.json) as a file
snapshot, which is where `packages/formats` compares its own read of the same
threat model against this one. Regenerate it with `pnpm nx test
@panoptes/model -- -u` in the commit that moved it.

[`SCHEMA.md`](SCHEMA.md) is the whole model expanded from the schemas
themselves, regenerated and checked on every test run.

Unit tests: `pnpm nx test @panoptes/model`.
