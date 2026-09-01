# Coding guidelines

The coding guidelines for Panoptes, binding for humans and agents alike.
These are requirements, not suggestions.

## Error handling

Fallible APIs return Effect's `Either`, with a package-owned tagged
failure on the error channel: an Effect `Data.taggedEnum` discriminated
on `_tag`, readonly, and serializing to its plain tagged shape. Throwing
is not an error channel in this project's TypeScript. `parseModel`
follows the same rule: zod stays behind the parse boundary, and its
issues surface as plain data on the failure.

A fallible function's own parameter and return types carry no zod type,
and its failure carries plain data. A type that holds a schema as a member,
or is parameterized by one, is not a fallible signature.

## Schema-first typing

Strict typing everywhere, schema-first. Zod schemas are the source of
truth, TypeScript types are inferred from them, and unions are
well-bounded. No hand-written types beside schemas, no unbounded strings
where a union is knowable.

## Zod composition

Shared object fields are expressed with zod's own composition: a base
`z.object` extended per variant with `.extend()`. Never spread raw field
maps into schema literals.

`z.object` is the default for every schema, including the ones whose shape
Panoptes owns: demanding about what it declares, and dropping what it does
not. `strictObject` is not used. Refusing a whole payload over one unknown
key is only safe with complete control of the data pipeline, which no
reader here has, and a file gains a field the first time another tool or a
later format version adds one. `looseObject` would carry along data that
nothing describes. Preservation rests on a wire schema declaring everything
its format carries, not on that tolerance, and the codec contract in
`packages/formats` requires a read to report a dropped key as a divergence,
so a strip is never silent and an incomplete schema shows up.

## Comments

Comments in TypeScript source are TSDoc on exports only, a simple summary
of the non-obvious. Config files (workflows, the flake, tool config like
`playwright.config.ts`) keep their constraint comments.

## Tests

Tests pin this project's decisions and regressions in broad strokes. They
do not re-verify what a dependency's own test suite or the type-checker
already guarantees.

## Prose register

Canadian English, no em- or en-dashes, no filler adjectives.

## Dependencies and versions

Single version policy: external dependency versions live only in the
`pnpm-workspace.yaml` catalog. Leaf manifests use `catalog:` and
`workspace:*` references.

A package the code imports is declared in the importing package's own
manifest, test-only ones under `devDependencies`. Never reach a library
through another package's re-export, or rely on it resolving transitively:
the version tested against is then someone else's to change.

## Build targets

Targets are root-defined: nx plugins and `targetDefaults` own task
configuration. A leaf project opts in with a config file or an
executor-only marker, and deviations need a stated reason.

## Workflows and CI

Pin every GitHub Action to a full commit SHA, never a tag, with the
version in a trailing comment. Renovate bumps them. CI's static-checks
job fails an unpinned action (zizmor, hash-pin policy in
[`.github/zizmor.yml`](.github/zizmor.yml)).

Keep workflows injection-free. Never interpolate untrusted
`${{ github.event.* }}` or `${{ github.head_ref }}` into `run:` blocks.
Pass them through `env:` or intermediate files. CI's static-checks job
fails a violating expression (actionlint and zizmor both catch it).

## Diagrams

Diagrams are Mermaid, not ASCII art: a fenced ` ```mermaid ` block, never
box-drawing characters.
