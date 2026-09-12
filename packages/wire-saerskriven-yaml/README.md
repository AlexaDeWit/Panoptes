# @saerskriven/wire-saerskriven-yaml

The Saerskriven YAML format, version 1, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

The format is a contract with files people already have, so this schema is
the only authority on it. It declares its own ids, its own vocabularies, and
its own record shapes, and it imports zod and nothing else. The layer matrix
enforces that: `layer:wire` may depend on no internal package, so a schema
here cannot be built out of the internal model's.

Where a name here matches one in `@saerskriven/model`, the two are the same
today and are free to stop being. The model is ours to change as the editor
and later milestones need; version 1 of the format is not, and a change to
what it means is a version bump rather than a consequence of some other
change. `@saerskriven/formats` maps between the two, and is the only place that
knows both.

An id is any non-empty string, unbranded: the model brands its ids at its own
parse boundary, and a file is not a model. Nothing here is defaulted and
nothing is transformed. Every key the first release of version 1 declared is
required; a key a later release added is optional, so a file written before
it still reads, and `@saerskriven/formats` supplies what its absence means and
states it on a write wherever the model holds a value for it. A flow's
`bidirectional` and an attached endpoint's `side` are the two so far: a write
states `bidirectional` on every flow and `side` on every pinned end.

`formatVersion` is a zod literal, so a file stamped with any other release
fails at that path rather than reaching the mapping. Within version 1 a key
this schema does not declare is dropped rather than refused, and the codec
reports it, so a file from a later release still reads.

A change version 1 cannot absorb is a new `formatVersion`, and a version gets
a package of its own: `wire-saerskriven-yaml-v2` would sit beside this one,
each declaring one version, and this one would go on declaring version 1
unchanged. The migration step from one version to the next belongs in
`@saerskriven/formats`, the only layer the matrix lets know two wire packages.
Nothing past version 1 exists yet.

[`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the file
itself. The codec is `readSaerskrivenYaml` and `writeSaerskrivenYaml` in
[`@saerskriven/formats`](../formats/README.md).

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml`.
