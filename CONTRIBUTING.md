# Contributing

How we work on Panoptes: the contribution process and the repository's
requirements. Setup and build live in the [README](README.md#development).

## Working language

Write issues and discussion in **English**, so the next person with the same
problem can find them. Rough English is welcome, and so is your own language
run through a translator. If English is a real barrier, I also read **French**
and **Swedish**. Source code, identifiers, comments, and commit messages stay
in English.

## AI-assisted contributions

AI-assisted work is welcome, but the bar does not change. **You are the
author. You must understand and be able to explain every line. The
contribution must be worth more than the time it takes to review.** We close
low-effort, unreviewed AI output ("slop").

- **Disclose non-trivial AI use**. Editor autocomplete needs no disclosure.
  AI-generated or substantially AI-shaped code, prose, or commits do. Add an
  `Assisted-by:` git trailer that names the tool, for example
  `Assisted-by: <Agent Name> (<Vendor>)`, and mention it in the PR. The
  trailer records a tool that helped. You remain the sole author, so it is
  **not** `Co-authored-by:`.
- **Verify before you file**. Never open an issue that an AI produced and you
  have not reproduced yourself. This matters most for a vulnerability report
  (see [`SECURITY.md`](SECURITY.md)).

## Developer Certificate of Origin (DCO)

Panoptes is, and will remain, free and open-source software. We accept
contributions under the **[Developer Certificate of Origin](DCO)** (DCO,
v1.1). It is a lightweight per-commit affirmation that you have the right to
submit your work under the project's [Apache-2.0 licence](LICENSE). We chose
the DCO over a Contributor Licence Agreement on purpose. It asks you only to
certify provenance. It grants the project no power to relicense or close the
code, so Panoptes stays permanently FOSS.

**Sign off every commit**. `git commit -s` (or `--signoff`) appends a
`Signed-off-by` trailer from your git identity:

```
Signed-off-by: Your Name <you@example.com>
```

- **Every commit in a PR** needs a `Signed-off-by` that matches its author.
- It is **separate from the GPG signature**. `-S` proves who committed. `-s`
  certifies your right to contribute. Use both: `git commit -S -s`.
- **Forgot one?** `git commit --amend -s --no-edit` fixes the last commit.
  `git rebase --signoff main` signs off a whole branch.

## Pull requests

Open as a draft while work or review is moving, and mark it ready when it is
not. Fill every section of the template, and tick a checklist item only when
it is true. Otherwise say "not applicable" and why.

The Summary is the part worth effort. A reviewer reads it before the diff, so
write it so someone who has not opened the diff understands the change on its
own. Two to five sentences: what changed and why. Lead with what a reviewer
or user gains or is protected from. The mechanism comes second, and only as
far as the diff does not already show it. No play-by-play of files. End with
`Closes #NNN` where an issue completes.

Before you push, run the local check:

```sh
pnpm nx run-many -t build typecheck test
```

## Repository requirements

- **Use [Conventional Commits](https://www.conventionalcommits.org/)**.
  Subjects are `type(scope): summary`. `type` is one of `feat`, `fix`,
  `docs`, `chore`, `ci`, `refactor`, `test`, `build`, `perf`. The scope is
  optional. Keep the summary short and imperative.
- **Commits are GPG-signed and DCO signed off** (see above). Disclose
  non-trivial AI assistance with an `Assisted-by:` trailer.
- **Single version policy**: external dependency versions live only in the
  `pnpm-workspace.yaml` catalog. Leaf manifests use `catalog:` and
  `workspace:*` references.
- **Targets are root-defined**: nx plugins and `targetDefaults` own task
  configuration. A leaf project opts in with a config file or an
  executor-only marker, and deviations need a stated reason.
- **Pin every GitHub Action to a full commit SHA**, never a tag, with the
  version in a trailing comment. Renovate bumps them.
- **Keep workflows injection-free**. Never interpolate untrusted
  `${{ github.event.* }}` or `${{ github.head_ref }}` into `run:` blocks.
  Pass them through `env:` or intermediate files.
- **Diagrams are Mermaid, not ASCII art**: a fenced ` ```mermaid ` block,
  never box-drawing characters.
