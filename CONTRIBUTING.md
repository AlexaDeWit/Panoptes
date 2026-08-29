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
not. The body is three headings, **What** (the goal), **Why** (the
motivation), and **Consequences** (user-visible changes, deviations,
trade-offs, one sentence each; the section goes when there are none), plus a
one-line AI-assistance disclosure. Readable in seconds. There is no
checklist on purpose: the gate enforces its items, and a body should not
restate a gate.

A reviewer reads the body before the diff, so write it so someone who has
not opened the diff understands the change on its own. Lead with what a
reviewer or user gains or is protected from. The mechanism comes second, and
only as far as the diff does not already show it. No play-by-play of files.
The body never carries checklists, evidence transcripts, or per-round
appendices: that audit trail lives in the commit message of the change that
produced it, and a review round rewrites the body only when the goal or a
consequence changed. End with `Closes #NNN` where an issue completes.

Before you push, run the local check:

```sh
pnpm check
```

## Decision records

[`docs/decisions/`](docs/decisions/) holds the reasoning for **major**
decisions only: sweeping consequences that cannot be undone without serious
commitment. A weekend of rework is not serious commitment. Two more rules:

- A record is written only when the maintainer explicitly asks for one.
  Offering one is fine. Producing one unbidden is not.
- If the reasoning already lives where it bites (a README section, a comment
  beside the config it constrains, the PR that made the change), it stays
  there. Self-documenting artifacts win.

## Repository requirements

- **Use [Conventional Commits](https://www.conventionalcommits.org/)**.
  Subjects are `type(scope): summary`. `type` is one of `feat`, `fix`,
  `docs`, `chore`, `ci`, `refactor`, `test`, `build`, `perf`. The scope is
  optional. Keep the summary short and imperative.
- **Commits are GPG-signed and DCO signed off** (see above). Disclose
  non-trivial AI assistance with an `Assisted-by:` trailer.
- **The engineering rules live in [`CODING.md`](CODING.md)**.
