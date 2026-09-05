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
  [YAML format of our own](docs/panoptes-yaml.md). A model file in git is the
  source of truth, and a codec names every place a file and the model do not
  correspond, rather than passing over it in silence.
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

| Project                       | What it holds                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/model`              | The internal data structures and operations on them                                                                                                                                                                     |
| `packages/wire-panoptes-yaml` | The Panoptes YAML format, version 1, as a schema and nothing else                                                                                                                                                       |
| `packages/wire-threat-dragon` | The Threat Dragon v2 format as a schema and nothing else                                                                                                                                                                |
| `packages/formats`            | File-format codecs, and the mappings between a file and the model                                                                                                                                                       |
| `packages/canvas`             | React canvas components, shared by the UI and headless rendering                                                                                                                                                        |
| `packages/render`             | Projections of a model: SVG, markdown, and the Typst source a PDF is compiled from                                                                                                                                      |
| `apps/studio`                 | The drawing UI: its [canvas](apps/studio/src/canvas/README.md), its [model store](apps/studio/src/store/README.md), its [file bridge](apps/studio/src/files/README.md) and its [controls](apps/studio/src/ui/README.md) |
| `apps/cli`                    | The command-line interface                                                                                                                                                                                              |

A wire package declares one file format and depends on zod alone, so no
change to the internal model can change what a released format version
means. `packages/formats` is the only project that knows both a format and
the model.

[`threat-modelling/`](threat-modelling/README.md) holds Panoptes' own threat
model, in the native format, kept valid by the same suites that read it as a
fixture.

## Install

The CLI ships as one executable per platform, attached to every
[release](https://github.com/AlexaDeWit/Panoptes/releases). It carries its own
runtime, so there is nothing else to install: no node, no npm, no browser.

| Executable                                      | Platform              |
| ----------------------------------------------- | --------------------- |
| `panoptes-<version>-x86_64-unknown-linux-gnu`   | Linux, Intel or AMD   |
| `panoptes-<version>-aarch64-unknown-linux-gnu`  | Linux, 64-bit ARM     |
| `panoptes-<version>-x86_64-apple-darwin`        | macOS, Intel          |
| `panoptes-<version>-aarch64-apple-darwin`       | macOS, Apple silicon  |
| `panoptes-<version>-x86_64-pc-windows-msvc.exe` | Windows, Intel or AMD |

Download yours and the `SHA256SUMS` file beside it, then:

```sh
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify panoptes-* --repo AlexaDeWit/Panoptes \
  --signer-workflow AlexaDeWit/Panoptes/.github/workflows/ci.yml
chmod +x panoptes-*
mkdir -p ~/.local/bin
mv panoptes-* ~/.local/bin/panoptes
panoptes --version                 # prints the release's version
```

The checksum says the file arrived whole. The attestation says where it came
from: a signed statement, recorded when the executable was built, that this
exact file came out of a named workflow in a named repository. The two flags
are what make that a check rather than a display. `--repo` enforces the
repository, `--signer-workflow` enforces that the signer was this repository's
CI workflow, and the command fails if either is not so. Without
`--signer-workflow` the workflow is printed but not enforced, and any workflow
in the repository able to write attestations would satisfy the check.

What it does not tell you is which commit the file was built from: the
attestation carries that, and `gh attestation verify` prints it, but no flag
makes it a condition. An asset with no attestation, or one naming another
repository or another workflow, is not ours, whatever it is attached to. The
command needs [the GitHub CLI](https://cli.github.com/) and reads the
attestation from GitHub, not from the download.

On Windows, rename the file to `panoptes.exe` and put it somewhere on `PATH`.
On macOS the executables are unsigned, so Gatekeeper holds the first run:
`xattr -cr ~/.local/bin/panoptes` clears the quarantine flag. Signing and
notarization are deferred, not overlooked.

## Usage

```sh
panoptes validate threat-model.yaml
panoptes render threat-model.yaml --format md --out register.md
panoptes render threat-model.yaml --format svg --out diagram.svg
panoptes render threat-model.yaml --format pdf --out threat-model.pdf
panoptes render threat-model.yaml --format svg --out -
```

Both commands read Threat Dragon v2 JSON and Panoptes YAML, and the content
decides which: the file name is never consulted, so a model saved under any
extension reads.

`validate` prints one line naming the format and what the model holds, and
warns on standard error wherever the file and the model do not correspond
exactly, which is what a read dropped or held less exactly than the file
stated it.

`render` writes a projection. `--format md` writes the whole threat
register. `--format svg` draws one diagram, which `--diagram <id or title>`
chooses where the model holds more than one, and which a model of one does
not have to name. `--format pdf` writes one document holding every diagram,
one to a landscape page, then that same register, so it takes no `--diagram`
either. `--out -` writes to standard output, the PDF's bytes included.

The PDF is compiled by Typst, which the executable carries as a WebAssembly
module together with the fonts it typesets with. Nothing is fetched and no
browser is involved, so `--format pdf` works with no network and on a machine
that has neither Typst nor a browser installed.

| Exit code | What it means                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | The command did what it was asked.                                                                                                                                                                                                                                                                                                                                                      |
| 1         | Panoptes read the file and refused it: no format claimed it, or one did and either the document or the model it maps to is not valid.                                                                                                                                                                                                                                                   |
| 2         | The invocation cannot be carried out: the parser or the option schema refused it, a file cannot be read or written, a choice names no diagram, a stream refused the output, a pipe whose reader closed aside, or a projection could not be produced from a model Panoptes accepted, which is the PDF typesetter refusing the document or an install missing the files it typesets with. |

Errors go to standard error, path-precise where a schema refused something,
and no failure prints a stack trace.

## Development

Nix with flakes provides the toolchain (node, pnpm, deno). With
[direnv](https://direnv.net/), `cd` into the checkout and it loads itself.

```sh
nix develop            # or let direnv do it
pnpm install
pnpm check             # everything the CI gate runs
pnpm fix               # write formatting and lint fixes
pnpm nx e2e @panoptes/studio-e2e   # browser smoke, excluded from pnpm check
semgrep scan --config auto --severity ERROR --severity WARNING --error .   # SAST scan, excluded from pnpm check
scripts/check-provenance.mjs       # dependency provenance, excluded from pnpm check
```

The live loop: `pnpm nx serve studio` hot-reloads the studio app, and
`pnpm nx test <project> --watch` reruns a project's tests on change.
[`.vscode/settings.json`](.vscode/settings.json) points VS Code at the
workspace TypeScript and wires format-on-save to the oxc extension
(`oxc.oxc-vscode`), which formats through the repository's pinned oxfmt,
so the editor and the format check inside `pnpm check` agree.

### Packaging the CLI

`nx build @panoptes/cli` bundles the CLI into one ESM file with every
workspace package and every dependency inlined, which is why that project's
build deviates from the root esbuild defaults (the reasons sit in
[`apps/cli/package.json`](apps/cli/package.json)). The bundle carries the
version stamped in from the root manifest, the one number `nx release` writes
across the workspace.

[`scripts/package-cli.sh`](scripts/package-cli.sh) turns that bundle into
standalone executables with `deno compile`, cross-compiling every target from
any one of them, and runs the host executable three times: once for the
version it reports, once to validate a vendored model file, and once to render
that file to a PDF. CI runs the script for the
host target on every pull request, and over the whole matrix when the ref is a
`v*` tag, which is how a release is built: one workflow, not a second pipeline
beside it. Deno is a packaging tool only: it never resolves the workspace, and
node stays the development and test runtime.

The pull request run then puts the CLI's whole scenario table through that
executable, with `PANOPTES_COMPILED_RUNNER=required` so a missing executable
fails the suite rather than dropping a runner in silence. `dist/cli` is
gitignored and therefore no nx input, so that run skips the nx cache, and so
should a local one after a recompile.

Around 33 MB of every executable is a runtime deno embeds, which the nixpkgs
deno pin does not cover. The flake pins it by hash, the compile runs with no
network, and every target is built twice from a bundle stamped with a fixed
name, modification time and mode, so one commit gives one executable on any
Linux machine. What each control is for, and how to bump the hashes when deno
moves, is in
[the release procedure](docs/release.md#maintenance-the-runtime-inside-an-executable).
[Rebuilding a released executable](docs/release.md#rebuilding-a-released-executable)
is the check anyone can run against a download.

A file the executables must carry rides along as an argument to
`deno compile --include <path>` in that script, and the code reaches it at run
time through `import.meta.dirname`. Anything not included, and not inlined
into the bundle by esbuild, does not exist for a user who has only the
executable. `apps/cli/dist/assets` is that directory today: the Typst
WebAssembly module, which the build copies out of node_modules, and five
Liberation faces with their licence, which it copies out of the store path
`PANOPTES_FONTS_DIR` names. Neither is committed. The module is pinned by the
catalog and the lockfile and the fonts by the nixpkgs revision in
`flake.lock`, and a build outside the flake shell stops with the missing
variable named rather than writing an executable that cannot typeset.
Liberation Sans is metric-compatible with Arial, which is what the canvas
stylesheet asks for, so a diagram embedded in a PDF keeps the layout the
canvas measured. The directory is 28.89 MiB, and an executable grows by
28.95 MiB, the difference being the compiler package's JavaScript, which
esbuild inlines into the bundle. Everything the script stages is stamped with
one modification time and one mode, the assets as well as the entry point, so
the bytes stay a function of the inputs rather than of the machine. The
packaging script then renders the vendored fixture to a PDF through the
compiled executable, so an executable compiled without the compiler module
fails there rather than in a user's hands. A missing face is not that check's
to catch, since a document typeset without one is still a PDF: the build's own
refusal is what keeps a fontless executable from being made at all.

[`docs/release.md`](docs/release.md) is the release procedure.

See [`CODING.md`](CODING.md) for the coding guidelines,
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution process,
[`SECURITY.md`](SECURITY.md) for reporting vulnerabilities, and
[`GOVERNANCE.md`](GOVERNANCE.md) for how decisions get made.

## Licence

[Apache-2.0](LICENSE). Copyright 2026 Alexandra de Wit. Includes material
derived from OWASP Threat Dragon, see [`NOTICE`](NOTICE).
