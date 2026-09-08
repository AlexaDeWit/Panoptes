# Using the released CLI from Nix

`packages.${system}.saerskriven` installs `bin/saerskriven` from the release
pinned in [`nix/release.json`](../nix/release.json). Each asset has a versioned
URL and a committed SHA-256 hash. Evaluation reads only local Nix and JSON
files. Building fetches the selected asset if the Nix store does not hold it.
Shell entry never resolves Latest or downloads a checksum file.

The package carries the CLI runtime, PDF compiler, and fonts. It needs no
Saerskriven checkout or separate Node, Deno, browser, or Typst installation.
The CLI version follows the release pin, not the source checkout's workspace
version.

## Downstream shells

This minimal Écluse example uses Écluse's nixpkgs for both shells and the CLI.
Add the same package to the existing shell definitions during integration.
That integration remains a separate change in Écluse.

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    saerskriven.url = "github:AlexaDeWit/Saerskriven";
    saerskriven.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { nixpkgs, saerskriven, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ saerskriven.overlays.default ];
      };
      shell = pkgs.mkShell { packages = [ pkgs.saerskriven ]; };
    in {
      packages.${system}.saerskriven = pkgs.saerskriven;
      devShells.${system} = { default = shell; ci = shell; };
    };
}
```

Run `nix flake lock` once and commit `flake.lock`. It locks the Saerskriven
source revision as well as nixpkgs. The first pin must contain this package
support. The `v0.1.0` source tag predates it.

```sh
nix build .#saerskriven
nix develop --command saerskriven --version
nix develop .#ci --command saerskriven validate threat-model.yaml
```

The overlay calls [`nix/package.nix`](../nix/package.nix) with the caller's
`pkgs`. A caller without overlays can use
`pkgs.callPackage "${saerskriven}/nix/package.nix" { }`.
The direct `saerskriven.packages.${system}.saerskriven` output uses the flake's
nixpkgs input, including any downstream `follows` relationship.
Unsupported systems fail with the supported systems listed.

## Linux compatibility and execution coverage

The Linux binaries require glibc's loader and `libdl`, `librt`, `libpthread`,
`libm`, `libc`, and GCC's `libgcc_s`. The package records the loader and
library search paths from the caller's nixpkgs. It does not rely on NixOS's
`nix-ld`, `/lib64`, or host library paths.

The v0.1.0 runtime uses Deno 2.8.3 and
[libsui 0.12.6](https://docs.rs/crate/libsui/0.12.6/source/lib.rs).
Its ELF payload ends with a 16-byte trailer: little-endian magic `0x501e`,
the name hash `0x2a7` for `d3n0l4nd`, and the payload size including the
trailer. The runtime locates that data relative to EOF.

Direct `patchelf` moves the trailer away from EOF and fails with
`error: Could not find standalone binary section.` Invoking the unchanged
binary through the loader also fails because the runtime reads
`/proc/self/exe`, which then names the loader.
The package validates the trailer, separates the payload, patches the ELF
runtime, and appends the unchanged payload and trailer. It disables later
fixup so stripping cannot remove them. The macOS package copies the release
bytes without changing its Mach-O signature.

| Nix system       | Release hashes and provenance | Execution checks                                     |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| `x86_64-linux`   | Verified                      | Nix sandbox locally and in the required CI build job |
| `aarch64-linux`  | Verified                      | Not executed                                         |
| `x86_64-darwin`  | Verified                      | Not executed                                         |
| `aarch64-darwin` | Verified                      | Not executed                                         |

The other three packages have committed asset pins. This table makes no
claim that they execute successfully. Run the check on a native host before
relying on an untested target.

```sh
nix build --no-link --print-build-logs .#checks.x86_64-linux.saerskriven
nix flake check --all-systems --no-build
```

Substitute the native system in the first command. On Linux, use a Nix daemon
with `sandbox = true`. The sandbox exposes only declared build inputs and
has no external network route. The check runs the installed package from a
scratch directory, validates the committed Écluse model, and renders Markdown,
SVG, and PDF. It checks PDF text and embedded Liberation fonts with Poppler.
No external Node, Deno, browser, or Typst executable is on the check's PATH.
Poppler belongs to the check, not the installed CLI's runtime closure.

## Updating the release pin

The release build must finish publication and attestation before its hashes
can be pinned. Keep the previous pin during version preparation and tag CI.
After publication, run this command from a Saerskriven checkout:

```sh
RELEASE_VERSION=v0.1.0 nix develop --command pnpm nx run release-tools:update-nix
```

Set `RELEASE_VERSION` to the explicit stable version. Authenticate the GitHub CLI
before running it. The updater resolves that annotated tag's source commit,
downloads each asset named by the existing target map, and verifies its
attestation against this repository, `ci.yml`, the tag, and the source commit.
It computes SHA-256 from each verified asset's bytes. It replaces
`nix/release.json` only after every download and verification succeeds.
It does not execute downloaded binaries or change the workspace version.

Run the package checks above, review the version and hashes, and open a PR
for the packaging update. If Deno changes its payload format, review the
Linux adaptation before accepting the new pin. Record each target actually
executed, and keep untested targets marked as such.
Do not move the signed release tag. The later packaging commit references
already published assets, so its CI has no dependency on an unpublished
release. No automated step commits, pushes, or merges the update.

After that PR merges, update Écluse's input lock in its own reviewed change:

```sh
nix flake update saerskriven
nix develop --command saerskriven --version
nix develop .#ci --command saerskriven validate threat-model.yaml
```

Review the downstream lock diff and exercise the rendering commands the
project uses before merging that update.
