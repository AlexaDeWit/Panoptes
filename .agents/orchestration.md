# Orchestration reference

The project facts the orchestration skills defer to. One section per fact.
Edit here when the process changes, in the same PR as the change.

## Gating CI

- Required checks on `main`: **CI gate** and **codecov/project**.
- "CI gate" is the gating job in
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml); its `needs` list
  and verdict step define the gating set. Wire a new gating job into both.
- That workflow also runs on a `v*` tag, where it builds the release: the
  `publish` job after the gate `needs` it and runs on a tag ref alone. It is a
  consequence of a green gate, not a member of the gating set, so it belongs
  in neither the gate's `needs` nor its verdict.
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

## Worktrees

- One worktree per agent:
  `git worktree add ../panoptes-<branch> -b <branch>` from the repository
  root; `git worktree remove ../panoptes-<branch>` after merge.
- `node_modules` is per-worktree: run `pnpm install` inside the flake in each
  new worktree. The flake and direnv resolve per-worktree.

## Compaction

The team-lead seat compacts per
[`.agents/compact-prompt.md`](compact-prompt.md) and resumes with the
resume-orchestration skill.
