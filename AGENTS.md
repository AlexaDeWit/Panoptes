# Agent instructions

The constitution for agents working on Panoptes. These are requirements, not
suggestions.

## Start here

- **Read [`README.md`](README.md) first**: what Panoptes is, the package map,
  the development commands.
- **Escalate, don't guess.** Stop on an ambiguous, missing, or contradictory
  requirement instead of inventing a way through it.
- The tracker is the plan: milestones are the waves, issues are the slices,
  and issue bodies carry the acceptance criteria and dependency order.

| Work                                 | Read next                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Implement an issue                   | The issue body and its milestone description, then the packages it names                                                                    |
| Change build, CI, or dependencies    | [CONTRIBUTING, Repository requirements](CONTRIBUTING.md#repository-requirements) and [`.agents/orchestration.md`](.agents/orchestration.md) |
| Run or resume the orchestration loop | [`.agents/orchestration.md`](.agents/orchestration.md)                                                                                      |
| Commit or open a PR                  | [`CONTRIBUTING.md`](CONTRIBUTING.md) and the PR template                                                                                    |

## Invariants

- **Strict typing everywhere, schema-first.** Zod schemas are the source of
  truth, TypeScript types are inferred from them, and unions are
  well-bounded. No hand-written types beside schemas, no unbounded strings
  where a union is knowable.
- **Single version policy.** External versions live only in
  `pnpm-workspace.yaml`'s catalog. Leaf manifests use `catalog:` and
  `workspace:*` references.
- **Targets are root-defined.** nx plugins and `targetDefaults` own task
  configuration. A leaf opts in with a config file or an executor-only
  marker, and a deviation needs a stated reason.
- **Layer boundaries.** `model` imports no internal package; `formats` and
  `canvas` import only `model`; `render` imports `model` and `canvas`; apps
  import anything below them.
- **The flake is the toolchain authority.** Work inside `nix develop`. No
  global installs.
- **Local verification**: `pnpm check`, everything the CI gate runs
  (exclusions noted beside the script definition in `package.json`), plus
  the browser smoke as its own command: `pnpm nx e2e @panoptes/studio-e2e`.
  `pnpm fix` runs the writing variants.
- **One fact, one home.** Decision records only on the maintainer's explicit
  request ([CONTRIBUTING, Decision records](CONTRIBUTING.md#decision-records)).
- **Comments in TypeScript source are TSDoc on exports only**, and stay a
  simple summary of the non-obvious. Config files (workflows, the flake)
  keep their constraint comments.
- **Tests pin this project's decisions and regressions in broad strokes.**
  They do not re-verify what a dependency's own test suite or the
  type-checker already guarantees.
- **Prose register**: Canadian English, no em- or en-dashes, no filler
  adjectives.

## Commit and PR

Per [`CONTRIBUTING.md`](CONTRIBUTING.md): Conventional Commits, GPG-signed,
DCO signed-off as the human author, and non-trivial AI help disclosed with an
`Assisted-by:` trailer. Agents never merge; the maintainer merges.
