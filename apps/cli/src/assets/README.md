# Run-time assets

What the CLI reads at run time rather than links into its bundle. The build
copies this directory to `apps/cli/dist/assets`, adds the Typst WebAssembly
module beside it out of `node_modules`, and
[`scripts/package-cli.sh`](../../../../scripts/package-cli.sh) stages that
directory into every executable through `deno compile --include`. Only the
fonts and this licence are committed: the WebAssembly module is 28 MB and is
pinned by the catalog and the lockfile instead.

## The fonts

`--format pdf` typesets with these and nothing else. Nothing is read from the
host's font directories, so the same model gives the same PDF on every
machine, and a machine with no fonts installed renders the same document.

| Fact          | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Release       | `liberation-fonts-ttf-2.1.5`                                             |
| Origin        | https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5   |
| Obtained from | `pkgs.liberation_ttf` of the flake's pinned nixpkgs (`nixos-26.05`)      |
| Licence       | SIL Open Font License 1.1, in `LICENSE.liberation-fonts.txt` beside them |
| Copyright     | Digitized data copyright 2010 Google Corporation; copyright 2012 Red Hat |

| File                            | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `LiberationSans-Regular.ttf`    | `cfb8c07f8840806e6f4bb2b71cd8f73be4e94c136e428b943b55f57d41e75fea` |
| `LiberationSans-Bold.ttf`       | `12ef6aff74c7870757c627962c41ea50c2c60f8467b4a2039742086828a9edc9` |
| `LiberationSans-Italic.ttf`     | `bc01c7882aa905b047454fbd96a5e8fe989ed114b815e7611d3a504147a073bc` |
| `LiberationSans-BoldItalic.ttf` | `5d496239a8b04c94a420a1f039e416eae1d6b21a302317f2f698e58e86b8a961` |
| `LiberationMono-Regular.ttf`    | `4644793a5e8d46dc4ecf2d71a8f05a5f48f28bf225be079257660024d2e7bc68` |
| `LICENSE.liberation-fonts.txt`  | `93fed46019c38bbe566b479d22148e2e8a1e85ada614accb0211c37b2c61c19b` |

The licence travels with the fonts, into `dist/assets` and into every
executable, which is what the OFL asks of anyone who redistributes them.

Liberation Sans is metric-compatible with Arial, which is what the canvas
stylesheet asks for, so a diagram embedded in a PDF keeps the layout the
canvas measured. Liberation is a frozen family: 2.1.5 is from 2022, so this
is a cost paid once rather than a dependency that moves.

Committed rather than taken from the flake at build time, because a build
whose output depends on which shell ran it is a worse property than two
megabytes in git, and because the PDF's bytes should be a function of an
explicit pin rather than of a nixpkgs channel.

Mono ships in the regular face alone. Strong or emphasised inline code is
therefore synthesised by the typesetter rather than drawn from a real bold or
italic face. Adding the other three faces is 860 KB, which is not worth it
until a register needs them.
