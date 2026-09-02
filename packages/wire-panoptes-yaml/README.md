# @panoptes/wire-panoptes-yaml

The Panoptes YAML format, version 1, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

The format is a contract with files people already have, so this schema is
the only authority on it. It declares its own ids, its own vocabularies, and
its own record shapes, and it imports zod and nothing else. The layer matrix
enforces that: `layer:wire` may depend on no internal package, so a schema
here cannot be built out of the internal model's.

Where a name here matches one in `@panoptes/model`, the two are the same
today and are free to stop being. The model is ours to change as the editor
and later milestones need; version 1 of the format is not, and a change to
what it means is a version bump rather than a consequence of some other
change. `@panoptes/formats` maps between the two, and is the only place that
knows both.

An id is any non-empty string, unbranded: the model brands its ids at its own
parse boundary, and a file is not a model. Nothing is optional, nothing is
defaulted, nothing is transformed, so a read maps nothing away and a write
leaves nothing out.

`formatVersion` is a zod literal, so a file stamped with any other release
fails at that path rather than reaching the mapping. Within version 1 a key
this schema does not declare is dropped rather than refused, and the codec
reports it, so a file from a later release still reads.

[`docs/panoptes-yaml.md`](../../docs/panoptes-yaml.md) describes the file
itself. The codec is `readPanoptesYaml` and `writePanoptesYaml` in
[`@panoptes/formats`](../formats/README.md).

Unit tests: `pnpm nx test @panoptes/wire-panoptes-yaml`.
