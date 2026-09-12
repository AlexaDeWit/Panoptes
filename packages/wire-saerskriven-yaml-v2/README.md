# @saerskriven/wire-saerskriven-yaml-v2

The Saerskriven YAML format, version 2, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping. It
imports zod and nothing else, and the layer matrix (`layer:wire`) keeps it
from importing any internal package, the version 1 package included.

Version 2 sits beside
[`@saerskriven/wire-saerskriven-yaml`](../wire-saerskriven-yaml/README.md),
which goes on declaring version 1 unchanged. A file stamped with any other
`formatVersion` fails at that path, and a key the schema does not declare is
dropped rather than refused.

Nothing reads this package yet. The migration from version 1 to version 2
belongs in `@saerskriven/formats`, the only layer the matrix lets know two
wire packages, and so does the dispatch on `formatVersion`.
[`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the file
itself.

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml-v2`.
