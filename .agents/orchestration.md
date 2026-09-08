# Orchestration reference

The project facts the orchestration skills defer to. One section per fact.
Edit here when the process changes, in the same PR as the change.

## Gating CI

- Required checks on `main`: **CI gate** and **codecov/project**.
- The release tag guard requires **CI gate** on the exact `main` commit.
  Codecov commit statuses do not gate tags. Coverage upload is advisory on
  main, tag, and manual runs, with a two-minute timeout. PR uploads remain required.
- "CI gate" in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
  requires source checks, the website build, and verified artifact
  attestations. Source checks require the full CLI matrix and existing test
  and scan jobs. Wire each new gating job into its `needs` and verdict.
- Every PR rehearses the release builds. Repository PRs also generate and
  verify attestations. Fork and Dependabot tokens cannot sign, so the gate
  accepts an attestation skip only for those runs.
- `publish` follows the gate and runs only on a push to a `v*` tag. PRs
  upload workflow artifacts without creating releases or deploying Pages.
- `pages-prepare` and `pages-deploy` follow publication in the same workflow.
  A manual `deploy_pages` run on `main` retries the existing release archive.
  The `github-pages` environment permits `main` and `v*` tags.
- `publish` names the **`release`** GitHub environment, whose policy admits
  `v*` tags only. That and the tag rulesets are repository settings rather
  than workflow config, so a change to them is invisible in the diff;
  [`docs/release.md`](../docs/release.md) records the live configuration and
  the commands that read it back.
- A code scanning rule on `main` additionally requires a Semgrep OSS analysis
  per PR (alerts at `errors_and_warnings`, security alerts at
  `medium_or_higher`). The CI gate's semgrep step remains the strict
  enforcement: it fails the job on any ERROR or WARNING finding before the
  ruleset thresholds matter.
- Informational contexts: **codecov/patch** (explicit once #14 lands).

## Work decomposition

- Slices are GitHub issues. Milestones are the waves, worked in order:
  M0, M0.5, M1, M2, M3, M4, M5, M6.
- An issue body carries the goal, the acceptance criteria, and its dependency
  order. A cold start reads the milestone description before its issues.
- Assignment signals in-progress. One issue, one PR.
- Issue auto-close on merge: **on**, via `Closes #NNN` in the PR body
  ([CONTRIBUTING, Pull requests](../CONTRIBUTING.md#pull-requests)).

## Definition of done, per PR

- The issue's acceptance criteria hold, shown in the PR or ticked in the issue.
- A fresh-context review has passed.
- The CI gate is green and codecov/project holds.
- Commits are Conventional, GPG-signed, DCO signed-off, and AI-disclosed.
- Documentation updated in the same PR wherever behaviour, interfaces, or
  configuration changed.

## Verification mode

- The host is shared by every agent the lead runs, so local verification is
  a floor and the draft PR's CI run is the test evidence. Before the first
  push an implementer runs the lint and the typecheck of the projects it
  touched, the formatter, and the one spec file that pins its change, once.
  Nx hashes the source, configuration, toolchain and environment inputs. A
  changed input runs and an unchanged task replays. Proving a test bites by
  breaking it happens at that scope. Nothing heavier runs locally. Do not run
  `pnpm check` or a workspace-wide `run-many`. Run Playwright only for a
  browser slice, and run that spec alone.
- The implementer pushes the draft at once. The lead starts the CI watch at
  the PR-open report and dispatches the fresh review beside it, so CI and
  the review run in parallel rather than in series. A review reads the CI
  run's logs for the suite evidence and runs locally only spec-scoped break
  experiments: a single spec file, never a project's suite.
- A red CI run is routed as a fix commit on the same PR and both re-verify
  on the new head. A criterion that measures the host itself (a repeated-run
  flake count, a frame-time floor) is the exception and says so in its
  issue.

## Model allocation (OpenCode)

When the orchestration loop runs via OpenCode Go, all roles share one dollar pool:
$12 per rolling 5-hour window, $30 per week, $60 per month. There is no
Zen balance, so exhausting the pool blocks Go model requests until the
window resets.

- **Tech lead (resume-orchestration seat):** GPT 5.6 Luna
  (`opencode-go/gpt-5.6-luna`). Decision-heavy but low-volume. Strong
  reasoning, low per-token cost, 2,050 requests per 5-hour window,
  $15/month usage allocation.
- **Implementers (default):** Omen Alpha (`opencode-go/omen-alpha`).
  11,600 requests per 5-hour window, $100/month usage allocation,
  ~190 tokens per second, 500k context, reasoning. Highest throughput
  per dollar in the Go lineup, so the pool lasts longest on the volume
  seat. 23.14/40, rank 15 on the AI Coding Daily / OpenCode leaderboard
  (Sep 2026); identity unconfirmed. A workhorse, not a reviewer.
- **Reviewers:** GPT 5.6 Luna. Fresh-context evaluation sits at or
  above the implementer's quality tier; Luna gives an independent
  check on the implementer output.
- **Per-slice pin:** For design-bearing or security-sensitive slices,
  pin Kimi K2.7 Code (`opencode-go/kimi-k2.7-code`) or GPT 5.6 Luna
  on the implementer instead of the default, per the orchestration
  skill's pinning rule.
- **Pool exhaustion:** Free models continue to serve after a Go pool
  cap resets. Wire one into the opencode config fallback list so the
  loop degrades rather than stalling outright.

## Worktrees

- One worktree per agent:
  `git worktree add .agents/worktrees/<branch> -b <branch>` from the repository
  root; `git worktree remove .agents/worktrees/<branch>` after merge.
- `node_modules` is per-worktree: run `pnpm install` inside the flake in each
  new worktree. The flake and direnv resolve per-worktree.

## Compaction

The team-lead seat compacts per
[`.agents/compact-prompt.md`](compact-prompt.md) and resumes with the
resume-orchestration skill.
