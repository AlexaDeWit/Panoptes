# @panoptes/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence. Operations are pure functions returning new models:
graph edits (add, remove, move, resize) and threat register edits (add,
remove, replace, attach, detach). A threat number is issued once and never
moves: the model carries the highest number it has ever issued, so a removed
threat leaves a permanent gap and `nextThreatNumber` never hands its number
back. Coverage queries read a model without changing it: elements no threat
references, open threats by severity, and the threat count of every element.
Fallible exports return Effect's `Either`, carrying a package-owned
`_tag`-discriminated failure on the error channel; an infallible operation
returns its result bare. Nothing throws, and zod stays behind the parse
boundary on the terms [`CODING.md`](../../CODING.md) sets. Imports no
internal package.

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
