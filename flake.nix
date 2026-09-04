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
          # Packaging only: `deno compile` turns the CLI's esbuild bundle into
          # the standalone executables a release attaches
          # (scripts/package-cli.sh). Deno never resolves the workspace, never
          # runs a test, and never drives a build; node stays the development
          # and test runtime. Deno never upgrades itself: its version is
          # this binary's, and the runtime it embeds in an executable is
          # pinned separately by denortHashes below.
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
          PANOPTES_DENORT_CACHE = denortCache;
          PANOPTES_UNSHARE = "${pkgs.util-linux}/bin/unshare";
        };

        # Workflow linters. CI's static-checks job gates on these, and they
        # live in both shells so a local run matches the gate.
        workflowLintInputs = [
          pkgs.actionlint
          pkgs.zizmor
        ];

        # SAST scanner. CI's static-checks job gates on its findings, and it
        # lives in both shells so a local run matches the gate.
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
        # The pinned denort runtimes, buildable on their own so a cache can
        # be warmed without entering a shell.
        packages.denort-cache = denortCache;

        devShells = {
          # The shell every CI job enters: one closure, one cache entry.
          ci = pkgs.mkShell (shellEnv // playwrightEnv // denortEnv // {
            name = "panoptes-ci";
            buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
          });

          # The shell for humans. Currently identical to ci; interactive-only
          # tooling joins here, never in ci, so CI's closure stays lean.
          default = pkgs.mkShell (shellEnv // playwrightEnv // denortEnv // {
            name = "panoptes";
            buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
          });
        };
      });
}
