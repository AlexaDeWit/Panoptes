# Panoptes

A threat modelling studio: draw the system, and record the threats on the
diagram itself. Named for Argus Panoptes, the watchman whose hundred eyes look
in every direction at once, which is the posture threat modelling asks of you.

## Goal

Panoptes keeps the paradigm of [OWASP Threat Dragon](https://github.com/OWASP/threat-dragon),
element-attached threats edited in place on a data-flow diagram, and rebuilds
it on a typed core:

- **A typed internal model** as the single authority, richer than any one file
  format, with codecs at the edge.
- **File formats as codecs**: read and write Threat Dragon v2 JSON, plus a
  YAML format of our own. A model file in git is the source of truth, and a
  lossy export names what it dropped rather than dropping it silently.
- **A drawing UI** (React) where the diagram is the editor, not a picture
  beside a form.
- **A CLI** for headless work: validate a model, render it to SVG, markdown,
  or PDF, in CI or a docs build.

## Relationship to OWASP Threat Dragon

Panoptes is inspired by Threat Dragon and derives material from it, starting
with its model schema. We consider this project a derived work of Threat
Dragon and license it under the same Apache License 2.0. See
[`NOTICE`](NOTICE) for the upstream attribution.

## Structure

| Project            | What it holds                                                    |
| ------------------ | ---------------------------------------------------------------- |
| `packages/model`   | The internal data structures and operations on them              |
| `packages/formats` | File-format codecs (Threat Dragon v2 JSON, Panoptes YAML)        |
| `packages/canvas`  | React canvas components, shared by the UI and headless rendering |
| `packages/render`  | Projections of a model: SVG, markdown, PDF                       |
| `apps/studio`      | The drawing UI                                                   |
| `apps/cli`         | The command-line interface                                       |

## Development

Nix with flakes provides the toolchain (node, pnpm). With
[direnv](https://direnv.net/), `cd` into the checkout and it loads itself.

```sh
nix develop            # or let direnv do it
pnpm install
pnpm check             # everything the CI gate runs
pnpm fix               # write formatting and lint fixes
pnpm nx e2e @panoptes/studio-e2e   # browser smoke, excluded from pnpm check
semgrep scan --config auto --severity ERROR --severity WARNING --error .   # SAST scan, excluded from pnpm check
```

The live loop: `pnpm nx serve studio` hot-reloads the studio app, and
`pnpm nx test <project> --watch` reruns a project's tests on change.
[`.vscode/settings.json`](.vscode/settings.json) points VS Code at the
workspace TypeScript and wires format-on-save to the oxc extension
(`oxc.oxc-vscode`), which formats through the repository's pinned oxfmt,
so the editor and the format check inside `pnpm check` agree.

See [`CODING.md`](CODING.md) for the coding guidelines,
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution process,
[`SECURITY.md`](SECURITY.md) for reporting vulnerabilities, and
[`GOVERNANCE.md`](GOVERNANCE.md) for how decisions get made.

## Licence

[Apache-2.0](LICENSE). Copyright 2026 Alexandra de Wit. Includes material
derived from OWASP Threat Dragon, see [`NOTICE`](NOTICE).
