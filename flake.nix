{
  description = "panoptes: threat modelling studio";

  inputs = {
    # Single pinned nixpkgs: every tool comes from this one set.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  # Nothing here needs the flake's own source tree, but Nix always passes `self`,
  # so absorb it with `...` rather than binding it.
  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # A UTF-8 locale, so test-runner output encodes regardless of host locale.
        shellEnv = {
          LANG = "C.UTF-8";
          LC_ALL = "C.UTF-8";
        };

        # The runtimes only. The flake pins node and pnpm; pnpm-workspace.yaml
        # catalogs pin every JS dependency. package.json's packageManager field
        # must name the same pnpm version this set provides, so a run outside the
        # flake fails loudly instead of resolving differently.
        toolchainInputs = [
          pkgs.bashInteractive
          pkgs.nodejs_24
          pkgs.pnpm
        ];
      in {
        devShells = {
          # The shell every CI job enters: one closure, one cache entry.
          ci = pkgs.mkShell (shellEnv // {
            name = "panoptes-ci";
            buildInputs = toolchainInputs;
          });

          # The shell for humans. Currently identical to ci; interactive-only
          # tooling joins here, never in ci, so CI's closure stays lean.
          default = pkgs.mkShell (shellEnv // {
            name = "panoptes";
            buildInputs = toolchainInputs;
          });
        };
      });
}
