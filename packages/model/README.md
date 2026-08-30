# @panoptes/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence. Graph edit operations (add, remove, move, resize) are
pure functions returning new models. Imports no internal package.

Unit tests: `pnpm nx test @panoptes/model`.
