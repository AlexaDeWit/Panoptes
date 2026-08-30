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
returns its result bare. Nothing throws and no zod type appears in a fallible
export's signature. Imports no internal package.

Unit tests: `pnpm nx test @panoptes/model`.
