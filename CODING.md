# Coding guidelines

The coding guidelines for Panoptes, binding for humans and agents alike.
These are requirements, not suggestions.

## Error handling

Fallible operations return discriminated result unions, with zod's
`safeParse` shape as the local idiom. Throwing is not an error channel in
this project's TypeScript.

## Schema-first typing

Strict typing everywhere, schema-first. Zod schemas are the source of
truth, TypeScript types are inferred from them, and unions are
well-bounded. No hand-written types beside schemas, no unbounded strings
where a union is knowable.

## Zod composition

Shared object fields are expressed with zod's own composition: a base
`z.strictObject` extended per variant with `.extend()`. Never spread raw
field maps into schema literals.

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
