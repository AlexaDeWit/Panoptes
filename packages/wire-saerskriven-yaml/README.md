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
and later milestones need. Version 1 of the format is not, and a change to
what it means is a version bump rather than a consequence of some other
change. `@saerskriven/formats` maps between the two, and is the only place that
knows both.

An id is any non-empty string, unbranded: the model brands its ids at its own
parse boundary, and a file is not a model. Nothing here is defaulted and
nothing is transformed. Every key the first release of version 1 declared is
required. A key a later release added is optional, so a file written before
it still reads, and `@saerskriven/formats` supplies what its absence means and
states it on a write wherever the model holds a value for it. A flow's
`bidirectional` and an attached endpoint's `side` are the two so far: a write
states `bidirectional` on every flow and `side` on every pinned end.

`formatVersion` is a zod literal, so a file stamped with any other release
fails at that path rather than reaching the mapping. Within version 1 a key
this schema does not declare is dropped rather than refused, and the codec
reports it, so a file from a later release still reads.

A later release may add a value to a vocabulary within version 1, as the
assumption status `unconfirmed` was added. A file holding such a value fails
at its path in a release whose schema does not declare it.

A change version 1 cannot absorb is a new `formatVersion`, and a version gets
a package of its own. Version 2 is
[`@saerskriven/wire-saerskriven-yaml-v2`](../wire-saerskriven-yaml-v2/README.md),
beside this one, which goes on declaring version 1 unchanged. The migration
step from one version to the next belongs in `@saerskriven/formats`, the only
layer the matrix lets know two wire packages.

[`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the file
itself. The codec is `readSaerskrivenYaml` and `writeSaerskrivenYaml` in
[`@saerskriven/formats`](../formats/README.md).

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml`.
