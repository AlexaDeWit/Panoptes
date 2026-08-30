# @panoptes/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence. Graph edit operations (add, remove, move, resize) are
pure functions returning new models. Fallible exports return Effect's
`Either`, carrying a package-owned `_tag`-discriminated failure on the error
channel; nothing throws and no zod type appears in an exported signature.
Imports no internal package.

Unit tests: `pnpm nx test @panoptes/model`.
