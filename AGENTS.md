# Agent instructions

The constitution for agents working on Saerskriven. These are requirements, not
suggestions.

## Start here

- **Read [`README.md`](README.md) first**: what Saerskriven is, the package map,
  the development commands.
- **Escalate, don't guess.** Stop on an ambiguous, missing, or contradictory
  requirement instead of inventing a way through it.
- The tracker is the plan: milestones are the waves, issues are the slices,
  and issue bodies carry the acceptance criteria and dependency order.

| Work                                 | Read next                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Implement an issue                   | The issue body and its milestone description, then [`CODING.md`](CODING.md) and the packages it names |
| Change build, CI, or dependencies    | [`CODING.md`](CODING.md) and [`.agents/orchestration.md`](.agents/orchestration.md)                   |
| Run or resume the orchestration loop | [`.agents/orchestration.md`](.agents/orchestration.md)                                                |
| Commit or open a PR                  | [`CONTRIBUTING.md`](CONTRIBUTING.md) and the PR template                                              |

## Invariants

- **Coding guidelines**: [`CODING.md`](CODING.md) is binding, for agents
  and humans alike.
- **Layer boundaries.** `model` imports no internal package, and neither
  does a wire package (`layer:wire`), which declares one file format and
  depends on zod alone; `formats` imports `model` and the wire packages, and
  is the only layer that knows more than one of them; `canvas` imports only
  `model`; `render` imports `model` and `canvas`; apps import anything below
  them. `eslint.config.mjs` holds the matrix and the `boundaries` target
  enforces it.
- **The flake is the toolchain authority.** Work inside `nix develop`. No
  global installs.
- **Local verification**: `pnpm check`, everything the CI gate runs
  (exclusions noted beside the script definition in `package.json`), plus
  the browser smoke as its own command: `pnpm nx e2e @saerskriven/studio-e2e`,
  and the dependency provenance check as another:
  `scripts/check-provenance.mjs`. `pnpm fix` runs the writing variants. An
  agent on the shared orchestration host runs the floor in
  [`.agents/orchestration.md`, Verification mode](.agents/orchestration.md#verification-mode)
  and lets the draft PR's CI run carry the rest.
- **Test contracts.** Assert observable behaviour and stable domain data. Do
  not assert full UI prose, punctuation, or document-title copy. Assert exact
  text only when the text is a documented interface, such as serialized
  output, CLI output, or an accessible name.
- **One fact, one home.** Decision records only on the maintainer's explicit
  request ([CONTRIBUTING, Decision records](CONTRIBUTING.md#decision-records)).

## Documentation

- Write for a user or maintainer with a concrete task. Document usage,
  interfaces, constraints, and current limitations beside the feature they describe.
- Keep plans and task status in the tracker. Keep review and verification
  records in commit messages or PR discussion, per `CONTRIBUTING.md`.
- Do not commit session transcripts, handoff notes, temporary review artifacts,
  or prose that only justifies the agent's work.
- Keep each explanation in one home and link to it. Do not copy test names,
  milestone checklists, or implementation walkthroughs into READMEs.
- When behaviour changes, update or remove stale limitations and future-work
  claims in the affected documentation.

## Commit and PR

Per [`CONTRIBUTING.md`](CONTRIBUTING.md): Conventional Commits, GPG-signed,
DCO signed-off as the human author, and non-trivial AI help disclosed with an
`Assisted-by:` trailer. Agents never merge; the maintainer merges.
