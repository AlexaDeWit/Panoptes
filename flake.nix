{
  description = "saerskriven: threat modelling studio";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    let
      packageFor = pkgs: pkgs.callPackage ./nix/package.nix { };
    in {
      overlays.default = final: _prev: { saerskriven = packageFor final; };
    } // flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        shellEnv = {
          LANG = "C.UTF-8";
          LC_ALL = "C.UTF-8";

          # Nx sets FORCE_COLOR for child processes. Drop a host NO_COLOR so
          # Node does not warn when both variables reach those processes.
          #
          # SAERSKRIVEN_RESVG_WASM names where the rasterizer module will be
          # rather than a store path. The `resvg-wasm` nx project builds it to
          # that path and every consumer target depends on that build, so the
          # graph is what puts the file there (nix/resvg-wasm/project.json
          # holds the same path). The value is named here and not on the
          # consumer targets because it has to be absolute: nx strips
          # `{workspaceRoot}` out of an option value instead of expanding it,
          # so a target can only state a workspace-relative path, and most of
          # the consumer tasks run with their own project root as the working
          # directory. The CLI's build settles it either way: its executor is
          # not run-commands, which is the only kind nx passes an option's
          # environment to. The root is walked up to rather than read from
          # $PWD, so entering the shell in a subdirectory still names the one
          # path.
          #
          # The path has to stay under the workspace root. The studio's
          # development server allows that root and no longer names the
          # module's own directory, so a module outside it would come back as
          # Vite refusing to serve a file rather than as a sentence naming the
          # cause (apps/studio/build-assets.mts).
          shellHook = ''
            unset NO_COLOR
            workspace=$PWD
            while [ ! -e "$workspace/pnpm-workspace.yaml" ] && [ "$workspace" != / ]; do
              workspace=$(dirname "$workspace")
            done
            export SAERSKRIVEN_RESVG_WASM="$workspace/dist/resvg-wasm/lib/saerskriven_resvg.wasm"
            unset workspace
          '';

          # The build reads these pinned fonts. No font binaries live in git.
          SAERSKRIVEN_FONTS_DIR = "${pkgs.liberation_ttf}/share/fonts/truetype";
        };

        # The flake pins executable tools. JS libraries use the pnpm catalog.
        toolchainInputs = [
          pkgs.jq
          pkgs.gh
          pkgs.gnutar
          pkgs.bashInteractive
          pkgs.nodejs_24
          pkgs.pnpm
          # Deno packages the CLI. Node remains the development and test runtime.
          # The runtime embedded by Deno is pinned separately below.
          pkgs.deno
        ];

        # The denort runtime `deno compile` embeds in an executable, one entry
        # per target scripts/package-cli.sh builds. The URL version is
        # pkgs.deno's, so a deno bump moves all five URLs while the hashes
        # stay behind and the build fails on a mismatch. Renovate does not
        # know this fetch: refetch the hashes by hand, per the maintenance
        # section of docs/release.md, which says why they are pinned at all.
        denortVersion = pkgs.deno.version;

        denortHashes = {
          "x86_64-unknown-linux-gnu" =
            "sha256-IU0KQBDJxEMmqC6n/DeFwYmkPNg1Z9kaqk3OOWR1mVQ=";
          "aarch64-unknown-linux-gnu" =
            "sha256-Wsx0pLGhkaiKnOC2bPp+B3tQNSwSRinVGGxXEd9GJBU=";
          "x86_64-apple-darwin" =
            "sha256-/aDX6ZbQjvzpDSUhyYyETwHv3Kt3McES+7T+gQA849k=";
          "aarch64-apple-darwin" =
            "sha256-8miD/vuQqN4LdBHxzcVB8UIR8H1HPHxBW23xz87Gjso=";
          "x86_64-pc-windows-msvc" =
            "sha256-Mvuc5Bm042v7VtLTiXgma+6kNT5D84SmgPnSa9hbV28=";
        };

        # The layout deno reads before it reaches for the network:
        # $DENO_DIR/dl/release/v<version>/denort-<target>.zip.
        denortCache = pkgs.linkFarm "denort-cache-${denortVersion}"
          (pkgs.lib.mapAttrsToList (target: hash: {
            name = "dl/release/v${denortVersion}/denort-${target}.zip";
            path = pkgs.fetchurl {
              url =
                "https://dl.deno.land/release/v${denortVersion}/denort-${target}.zip";
              inherit hash;
            };
          }) denortHashes);

        # DENO_DIR is not set here: deno writes its own caches into it and this
        # path is read-only, so scripts/package-cli.sh points DENO_DIR at a
        # writable directory and links this tree in. unshare is named by path
        # rather than added to PATH, where util-linux would shadow tools
        # coreutils already provides.
        denortEnv = {
          SAERSKRIVEN_DENORT_CACHE = denortCache;
          SAERSKRIVEN_UNSHARE = "${pkgs.util-linux}/bin/unshare";
        };

        workflowLintInputs = [
          pkgs.actionlint
          pkgs.zizmor
        ];

        sastInputs = [
          pkgs.semgrep
        ];

        # Playwright browsers from the same pinned set: no playwright-managed
        # downloads at install or test time. The driver version is exported so
        # the version-equality test in apps/studio-e2e can red an unpaired
        # bump between this pin and the catalog's @playwright/test (#25).
        playwrightEnv = {
          PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
          PLAYWRIGHT_DRIVER_VERSION = pkgs.playwright-driver.version;
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          # The store's browsers link against nix-provided libraries, so
          # playwright's host-distribution check does not apply.
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        };
      in {
        packages.denort-cache = denortCache;
        # No dev shell carries this closure: the Rust toolchain is large and
        # entering a shell to work on the TypeScript should not pay for it
        # (issue #341). What changed with #379 is who runs the build: the
        # `resvg-wasm` nx project does, as a task every consumer depends on,
        # so a cold `nx build @saerskriven/studio` now triggers the Rust
        # compile where it used to refuse and name this command. The shell
        # still holds neither the toolchain nor the module.
        packages.resvg-wasm = pkgs.callPackage ./nix/resvg-wasm { };
        packages.saerskriven = packageFor pkgs;
        checks.saerskriven = pkgs.callPackage ./nix/check.nix {
          saerskriven = packageFor pkgs;
        };

        devShells = {
          # The shell every CI job enters: one closure, one cache entry.
          ci = pkgs.mkShell (shellEnv // playwrightEnv // denortEnv // {
            name = "saerskriven-ci";
            buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
          });

          # The shell for humans. Currently identical to ci; interactive-only
          # tooling joins here, never in ci, so CI's closure stays lean.
          default = pkgs.mkShell (shellEnv // playwrightEnv // denortEnv // {
            name = "saerskriven";
            buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
          });
        };
      });
}
