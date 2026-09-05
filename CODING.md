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

No recursive schema whose depth the input decides rather than the schema:
a file names the depth, and a walk that follows it runs out of stack inside
a function typed as returning a result union. Every path that reads foreign
text is bounded against the numbers `@panoptes/formats` exports as
`readLimits`: its size before it is parsed, its aliases as it is parsed, and
how deeply it nests once it has been. A text past a bound comes back as a
failure rather than throwing.

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

The root manifest is a leaf under that rule too, and what it declares is the
workspace's own tooling in four groups. First, the tools a root script or a
target's command runs: `nx`, `typescript`, `oxlint`, `oxfmt`, and `eslint` as
the host of the boundaries rule. Second, the nx plugins, generators and
executors `nx.json` names: `@nx/js`, `@nx/vite`, `@nx/vitest` and
`@nx/playwright` as plugins, `@nx/react` as the generator defaults, and
`@nx/esbuild` as the executor a build target selects. Third, what the root
configs import by name: `@nx/eslint-plugin` and `@typescript-eslint/parser` in
`eslint.config.mjs`, `vite` and `@vitejs/plugin-react` in `vite.shared.mts`,
`vitest` in `vitest.shared.mts` and `vitest.config.ts`. Fourth, a tool's
optional peers, held beside the tool that declares them so their versions are
this workspace's to pin rather than that tool's: `@swc-node/register` and
`@swc/core` for `nx`, `@swc/helpers` for `@swc/core`, `oxlint-tsgolint` for
`oxlint`, `jiti` for `eslint` and `vite`, `esbuild` for `@nx/esbuild` and
`vite`, `@types/node` for `vite` and `vitest`, and `jsdom`,
`@vitest/coverage-v8` and `@vitest/ui` for `vitest`, the first two of which
`vitest.shared.mts` selects as the environment and the coverage provider every
project tests under. `tslib` sits outside all four: `tsconfig.base.json` sets
`importHelpers`, so emitted code imports it.

Three entries are none of those. `@nx/web`, `@babel/core` and
`@babel/preset-react` are hard dependencies of `@nx/react` and `@nx/js`, so
declaring them at the root pins versions those plugins resolve anyway. They
are redundant rather than wrong, and retiring them is its own change. Leave
them until then.

React, react-dom, the testing libraries and Playwright are on none of these
lists, which is what the rule is for. A project that renders or tests React
declares them itself, so no project resolves them through the root.

A binary Panoptes did not author is a toolchain input rather than a file the
tree carries, so it comes from the flake or from the lockfile and its
provenance is that pin. The Liberation fonts the CLI typesets a PDF with
arrive as `PANOPTES_FONTS_DIR`, which both dev shells export from the pinned
nixpkgs' `liberation_ttf`, and the Typst WebAssembly module arrives through
the catalog. A build outside the flake fails naming the missing input rather
than writing an executable that cannot typeset. Text a spec reads is a
different thing: the vendored Threat Dragon schema under
`test-data/threat-dragon/schema/` is a fixture, versioned with the tests that
read it and readable in a diff, so it stays committed with its provenance
beside it.

## Build targets

Targets are root-defined: nx plugins and `targetDefaults` own task
configuration. A leaf project opts in with a config file or an
executor-only marker, and deviations need a stated reason.

Nx replays a cached task result when the hash of its declared inputs is
unchanged, and the default inputs are the project's own files plus
`sharedGlobals`. A task that reads a file outside its project root does
not see that file change, so an edited fixture can report green from the
run before the edit. Every such path is named in `sharedGlobals` or in the
target's `inputs` (`test-data/` is the case in the tree). The same holds
for what a task produces and consumes: files a task writes are restored
from cache only when listed in its `outputs`, and a task that needs another
project's output reaches it through the project graph, a `workspace:*`
dependency or `dependsOn`, never a relative path the graph cannot see.
`test` carries `^test` for that reason: `packages/model` writes
`test-data/ecluse.model.json` as a file snapshot, and the formats, canvas and
render suites read it, so the write is ordered ahead of every read along the
`workspace:*` edges those projects already have. CI restores no cache, so a
hole shows only in local runs.

A target that empties its output directory owns that directory alone. The
studio's vite build empties `dist/` on every run and nothing orders it
against the typecheck, so the typecheck emits its declarations under
`out-tsc/`. Sharing the directory leaves a declaration deleted under a build
info file that records it as written, which the next `tsc --build` reports
as TS6305.

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
