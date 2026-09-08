# Saerskriven

A threat modelling studio: draw the system, and record the threats on the
diagram itself.

The name `Saerskriven` is a simplified spelling of Swedish _särskriven_,
"written separately." It nods to _särskrivningar_, compound words split into
their parts. Threat modelling does similar work: it breaks apart a complex
problem or design so each risk can be examined.

## Goal

Saerskriven keeps the paradigm of [OWASP Threat Dragon](https://github.com/OWASP/threat-dragon),
element-attached threats edited in place on a data-flow diagram, and rebuilds
it on a typed core:

- **A typed internal model** as the single authority, richer than any one file
  format, with codecs at the edge.
- **File formats as codecs**: read and write Threat Dragon v2 JSON, plus a
  [YAML format of our own](docs/saerskriven-yaml.md). A model file in git is the
  source of truth, and a codec names every place a file and the model do not
  correspond, rather than passing over it in silence.
- **A drawing UI** (React) where the diagram is the editor, not a picture
  beside a form.
- **A CLI** for headless work: validate a model, render it to SVG, markdown,
  or PDF, in CI or a docs build.

## Relationship to OWASP Threat Dragon

Saerskriven is inspired by Threat Dragon and derives material from it, starting
with its model schema. We consider this project a derived work of Threat
Dragon and license it under the same Apache License 2.0. See
[`NOTICE`](NOTICE) for the upstream attribution.

## Structure

| Project                          | What it holds                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/model`                 | The internal data structures and operations on them                                                                                                                                                                                                                                                                              |
| `packages/wire-saerskriven-yaml` | The Saerskriven YAML format, version 1, as a schema and nothing else                                                                                                                                                                                                                                                             |
| `packages/wire-threat-dragon`    | The Threat Dragon v2 format as a schema and nothing else                                                                                                                                                                                                                                                                         |
| `packages/formats`               | File-format codecs, and the mappings between a file and the model                                                                                                                                                                                                                                                                |
| `packages/canvas`                | React canvas components, shared by the UI and headless rendering                                                                                                                                                                                                                                                                 |
| `packages/render`                | Projections of a model: SVG, markdown, Typst source, and the `pdf` subpath that compiles that source                                                                                                                                                                                                                             |
| `apps/studio`                    | The drawing UI: its [canvas](apps/studio/src/canvas/README.md), its [threat panel](apps/studio/src/panel/README.md), its [model store](apps/studio/src/store/README.md), its [file bridge](apps/studio/src/files/README.md), its [commands](apps/studio/src/commands/README.md) and its [controls](apps/studio/src/ui/README.md) |
| `apps/cli`                       | The command-line interface                                                                                                                                                                                                                                                                                                       |
| `apps/studio-e2e`                | The studio's [browser suite](apps/studio-e2e/README.md), and the round-trip coverage matrix it holds                                                                                                                                                                                                                             |

The studio also [imports OTM and TM-BOM](packages/formats/IMPORT.md) into new
native models. Their schemas live in `packages/wire-otm` and
`packages/wire-tmbom`.

A wire package declares one file format and depends on zod alone, so no
change to the internal model can change what a released format version
means. `packages/formats` is the only project that knows both a format and
the model.

[`threat-modelling/`](threat-modelling/README.md) holds Saerskriven's own threat
model, in the native format, kept valid by the same suites that read it as a
fixture.

## Install

The CLI ships as one executable per platform, attached to every
[release](https://github.com/AlexaDeWit/Saerskriven/releases). It carries its own
runtime, so there is nothing else to install: no node, no npm, no browser.

| Executable                                  | Platform              |
| ------------------------------------------- | --------------------- |
| `saer-<version>-x86_64-unknown-linux-gnu`   | Linux, Intel or AMD   |
| `saer-<version>-aarch64-unknown-linux-gnu`  | Linux, 64-bit ARM     |
| `saer-<version>-x86_64-apple-darwin`        | macOS, Intel          |
| `saer-<version>-aarch64-apple-darwin`       | macOS, Apple silicon  |
| `saer-<version>-x86_64-pc-windows-msvc.exe` | Windows, Intel or AMD |

### macOS and Linux

Download `install.sh` from the [latest release](https://github.com/AlexaDeWit/Saerskriven/releases/latest).
The installer selects your platform and checks the executable against its
embedded SHA-256 before installing it as `~/.local/bin/saer`.
The compatibility command `saerskriven` is a symbolic link to `saer`.
It needs Bash, curl, and either `sha256sum` (Linux) or `shasum` (macOS).
Linux executables require glibc. Alpine Linux's musl is not supported.

Download the script to a file, inspect it, then run it as your own user:

```sh
curl -q --fail --show-error --location --proto '=https' --proto-redir '=https' \
  --output install.sh \
  https://github.com/AlexaDeWit/Saerskriven/releases/latest/download/install.sh
less install.sh
bash install.sh
```

The script embeds its release tag and all binary hashes at build time.
It downloads only the selected binary. A newer release appearing during installation
cannot mix the selected executable and checksums. To choose an older release,
download its `install.sh` from that release's page. Releases published before
this installer was added require a manual download.

If `~/.local/bin` is absent from your PATH, add this line to `~/.bashrc` (Bash)
or `~/.zshrc` (zsh), then open a new terminal:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Run `saer --version` to check the installed version.
Use `bash install.sh --bin-dir "$HOME/bin"` to select another absolute directory.
The installer never uses sudo or edits your shell configuration. Running a new
release's installer replaces the existing regular file after verification.
A failed download or verification leaves the existing executable unchanged.
It refuses symbolic links and directories at the `saer` executable path.
It also refuses an unrelated `saer` in the destination or on PATH. Updates
recognise an existing installation by its `saerskriven -> saer` link.
An older installation containing only a regular `saerskriven` executable migrates
to the new layout. To uninstall, remove both `~/.local/bin/saer` and
`~/.local/bin/saerskriven`.

SHA-256 checks detect changed bytes. They do not prove build origin when an
attacker can replace both the executable and the installer. For build origin
verification, install [the GitHub CLI](https://cli.github.com/) and use:

```sh
bash install.sh --verify-attestation
```

This also requires a valid attestation for this repository, `ci.yml`, and the
embedded release tag before installation. A missing or mismatched attestation
fails the install. This option needs GitHub access through `gh`.
The installer itself is also checksummed and attested. To verify it before
execution, download it from a specific release and set `release_tag` to that tag:

```sh
release_tag=v0.1.0  # replace with the release you downloaded
gh attestation verify install.sh --repo AlexaDeWit/Saerskriven \
  --signer-workflow AlexaDeWit/Saerskriven/.github/workflows/ci.yml \
  --source-ref "refs/tags/$release_tag"
```

Add `--source-digest` with the signed tag's commit to require that commit too.

On macOS the executables are unsigned. If Gatekeeper blocks a verified download,
`xattr -d com.apple.quarantine ~/.local/bin/saer` removes its quarantine
attribute. The installer does not change Gatekeeper settings or execute the download.

### Other installation methods

Nix users can consume the pinned CLI through a locked flake input.
See [Nix installation and updates](docs/nix.md).

For a manual installation, download your executable and `SHA256SUMS` from the
same release. Compare `sha256sum <filename>` (Linux) or `shasum -a 256 <filename>`
(macOS) with the exact filename's entry before setting its executable bit and
moving it to your user bin directory. The attestation command above also works
with the executable's filename in place of `install.sh`.

Windows is outside the installer's scope. Download the `.exe` and `SHA256SUMS`
from the same release. In PowerShell, run `Get-FileHash .\<filename>.exe -Algorithm SHA256`
and compare the hash with that filename's entry. Rename the verified file to
`saer.exe` and put it in a user directory on PATH.

## Usage

Use `saer` for new scripts. The `saerskriven` compatibility command accepts the
same arguments and runs the same executable.

```sh
saer validate threat-model.yaml
saer render threat-model.yaml --format md --out register.md
saer render threat-model.yaml --format svg --out diagram.svg
saer render threat-model.yaml --format pdf --out threat-model.pdf
saer render threat-model.yaml --format svg --out -
```

Both commands read Threat Dragon v2 JSON and Saerskriven YAML, and the content
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

| Exit code | What it means                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0         | The command did what it was asked.                                                                                                                                                                                                                                                                                                                                                         |
| 1         | Saerskriven read the file and refused it: no format claimed it, or one did and either the document or the model it maps to is not valid.                                                                                                                                                                                                                                                   |
| 2         | The invocation cannot be carried out: the parser or the option schema refused it, a file cannot be read or written, a choice names no diagram, a stream refused the output, a pipe whose reader closed aside, or a projection could not be produced from a model Saerskriven accepted, which is the PDF typesetter refusing the document or an install missing the files it typesets with. |

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
pnpm nx e2e @saerskriven/studio-e2e   # browser smoke, excluded from pnpm check
semgrep scan --config auto --severity ERROR --severity WARNING --error .   # SAST scan, excluded from pnpm check
scripts/check-provenance.mjs       # dependency provenance, excluded from pnpm check
```

The live loop: `pnpm nx serve studio` hot-reloads the studio app, and
`pnpm nx test <project> --watch` reruns a project's tests on change.
[`.vscode/settings.json`](.vscode/settings.json) points VS Code at the
workspace TypeScript and wires format-on-save to the oxc extension
(`oxc.oxc-vscode`), which formats through the repository's pinned oxfmt,
so the editor and the format check inside `pnpm check` agree.

### Publishing the studio

CI builds the studio archive on every PR and ordinary main, tag, or manual run.
It generates and verifies attestations where the run's token permits signing.
Only tag pushes attach the archive to a GitHub release alongside the CLI.
The same [CI workflow](.github/workflows/ci.yml) then deploys that archive,
provided the release is GitHub's Latest stable release. It does not build `main`
for deployment. The studio shows the built version in a small badge above the React Flow
attribution. Other builds also say `development`. The Project menu links to
GitHub.

Dispatch CI from `main` with `deploy_pages=true` to retry the current Latest
release. This mode reuses its archive. It does not rebuild the website or publish a release.
In Pages settings, select **GitHub Actions** as the source. The
`github-pages` environment must permit `v*` tags for releases and `main` for
manual retries. Both paths verify the archive against its release commit.
[The release procedure](docs/release.md#website-promotion-and-recovery) describes
first-release setup and recovery.

The tag build reads the site's base path from GitHub, so project sites and
custom domains receive the matching asset URLs. A domain or base-path change
needs a new release because promotion keeps the archived website unchanged.

The same Pages value sets the canonical URL, `sitemap.xml`, and `robots.txt`.
A project site cannot control the host-root `robots.txt` on the shared
`github.io` domain. The generated file starts to govern crawlers when the site
uses a custom domain. Submit the sitemap URL to search engines after the first
deployment.

### Packaging the CLI

`pnpm nx compile @saerskriven/cli` builds and bundles the CLI, then compiles the
standalone host executable. The `saer.js` bundle inlines every workspace package and
dependency and carries the version from the root manifest.

The `compile` target runs [`scripts/package-cli.sh`](scripts/package-cli.sh),
which uses `deno compile` and can cross-compile every release target. It runs
the host executable three times: once for its version, once to validate a
vendored model, and once to render that model to PDF. CI also runs the compiled
CLI's scenario tests, then builds the whole matrix on every PR and ordinary
main, tag, or manual run. Deno is a packaging tool only. Node stays the
development and test runtime.

The `test-compiled` target puts the CLI's scenario table through that
executable. It requires the compiled runner and hashes the `compile` output.
Nx stores and restores `dist/cli` even though git ignores the directory.

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
WebAssembly module, which the build copies out of the node_modules of
`@saerskriven/render`, the package that declares the compiler, and five
Liberation faces with their licence, which it copies out of the store path
`SAERSKRIVEN_FONTS_DIR` names. Neither is committed. `apps/cli/src/pdf.ts` reads
them back at run time and hands the bytes to `@saerskriven/render/pdf`, which
compiles but reads no file, so the studio can compile the same document in a
browser from bytes of its own. The module is pinned by the
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
