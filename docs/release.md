# Cutting a release

The procedure for shipping a version of Panoptes: what the version number is,
who moves it, and what turns it into downloadable executables.

## What decides the version

One number for the whole workspace. The root [`package.json`](../package.json)
carries it, every project's manifest carries the same one, and the CLI build
stamps it into the executable, so `panoptes --version` and the tag cannot
disagree.

`nx release` writes that number. It reads the [Conventional
Commits](https://www.conventionalcommits.org/) subjects on `main` since the
last `v*` tag and derives the bump from them. Merges are squashed with the
pull request's title as the subject, so **PR titles decide version bumps**: a
`fix:` title is a patch, `feat:` a minor, and a `!` or a `BREAKING CHANGE:`
footer a major. While the workspace is on a `0.x` line nx shifts each of those
down one step, so a breaking change moves the minor and a feature the patch.

## Why a person runs most of it

The repository's rulesets, not preference, set the shape:

- **Tag Integrity** requires a signature on every tag and forbids deleting,
  updating or force-moving one. Its bypass list is empty, so no workflow token
  can create a tag here and no tag can be corrected after the fact.
- **PR Only** admits nothing to `main` except through a pull request, and its
  bypass list is empty too, so no workflow can push the version commit.
  **Main Integrity**, also with an empty bypass list, forbids deleting `main`
  or rewriting its history.
- **Signed Commits**, **PR Status Checks** and **Pull Requests Review** carry
  the rest of the requirements on `main`. Each of those three does name a
  bypass actor (the repository's admin role), so they are the maintainer's
  discipline rather than a wall; the three above are the wall, and they alone
  are what this procedure is shaped around.

So `nx release` writes files and touches git not at all
([`nx.json`](../nx.json), `release`), the owner lands them like any change, and
the owner signs the tag. The workflow's part starts after the tag exists.

## The procedure

### 1. Write the version and the changelog (owner, no credentials)

On a branch cut from an up-to-date `main`:

```sh
git switch -c release-v<version>
pnpm nx release version --dry-run     # read the bump it derives, and why
pnpm nx release version
pnpm nx release changelog <version>   # the version the step above wrote
```

`release version` writes the new version into every project manifest and into
the root manifest, and refreshes `pnpm-lock.yaml`. `release changelog` writes
the section for that version at the top of `CHANGELOG.md`. Read both diffs: the
changelog is what users will see on the release page.

Then run the local check, as for any change:

```sh
pnpm check
```

### 2. Land it on main (owner, no credentials)

Open a pull request in the usual way and merge it once the gate is green. Give
it a `chore(release): v<version>` title: it is the squash subject, and a
`chore` subject asks for no further bump.

### 3. Cut and push the signed tag (owner, GPG key)

On the merge commit, and nowhere else:

```sh
git switch main && git pull --ff-only
git show --stat HEAD                  # confirm this is the release merge
git tag -s "v<version>" -m "v<version>"
git push origin "v<version>"
```

`-s` is required: an unsigned tag is rejected by the ruleset. The tag cannot be
moved or deleted afterwards, so check the commit before pushing.

### 4. The executables are built and attached (automatic, no credentials)

Pushing the tag runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml),
the same workflow every pull request runs. There is no separate release
pipeline to drift from it: a release is what this one produces when the ref is
a tag.

Off a tag, `build-test` compiles the CLI for the host target alone, which is
what keeps the common run short. On a tag it compiles the whole matrix with
[`scripts/package-cli.sh`](../scripts/package-cli.sh), fails unless the Linux
executable's `--version` is the tag's, and hands the executables on as a
workflow artifact. Those three steps are the only ones the tag adds, and they
are skipped on every other run.

The **CI gate** then passes or fails exactly as it does on a pull request: its
jobs and its verdict do not change on a tag. A final **publish** job hangs off
the gate, runs only on a `v*` ref, takes the artifact, and creates or updates
the GitHub release with the executables and their `SHA256SUMS`. So a release
exists only where the whole gate was green on that tag.

Only that publish job holds `contents: write`, and it installs nothing and
compiles nothing, so the write permission never sits beside a dependency tree.
No job reads a secret: the workflow's own `GITHUB_TOKEN` is what talks to the
release API. If `CHANGELOG.md` has no section for the version, the notes fall
back to GitHub's generated ones rather than failing, because a tag cannot be
moved and a stopped release would leave the version unshippable.

### 5. Check what shipped (owner)

Download one executable from the release page, verify it against
`SHA256SUMS`, and run `panoptes --version`. The
[README's install section](../README.md#install) is the instruction a user
follows, so following it is the test of it.

## Maintenance: the runtime inside an executable

About 33 MB of every executable is the denort runtime `deno compile` embeds.
It is not the compiler, so the flake's deno pin does not cover it, and deno
would fetch it per target from `dl.deno.land` at build time. Three controls
replace that:

- **The runtimes are pinned by hash.** `flake.nix` holds one SHA-256 per
  target in `denortHashes` and assembles the five zips into the `DENO_DIR`
  layout deno reads before reaching for the network.
- **A compile has no network.** `scripts/package-cli.sh` runs every
  `deno compile` under `unshare -rn`, passes `--no-remote`, `--no-npm` and
  `--cached-only`, and refuses to run where no network namespace can be made.
  The workflow sets `DENO_NO_UPDATE_CHECK` and `DENO_NO_PROMPT`. A runtime
  that is not pinned therefore fails the compile; it cannot become a download.
- **Every target is built twice.** The script compiles each into two
  directories and fails unless the two are byte for byte the same, on a pull
  request as well as on a release.

**Bumping deno.** The URL version is `pkgs.deno.version`, so a nixpkgs bump
moves all five URLs while the hashes stay behind, and the build fails on a
hash mismatch rather than pairing a runtime with a compiler of another
version. Renovate does not know about this fetch, so replace the hashes by
hand:

```sh
version=$(nix develop --command deno eval 'console.log(Deno.version.deno)')
for target in x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu \
              x86_64-apple-darwin aarch64-apple-darwin \
              x86_64-pc-windows-msvc; do
  url="https://dl.deno.land/release/v${version}/denort-${target}.zip"
  base32=$(nix-prefetch-url --quiet "$url")
  echo "${target} $(nix hash convert --hash-algo sha256 --to sri "$base32")"
done
```

Paste the five into `denortHashes`, then run
`nix develop --command scripts/package-cli.sh --all` and confirm it compiles
offline. A new target needs an entry there before the script will build it:
the script checks and refuses, rather than fetching.

**Verifying locally needs Linux.** A network namespace is a Linux facility, so
`scripts/package-cli.sh` refuses to run on macOS or Windows, saying so, rather
than compiling with the network reachable. Cross-compiling every target from
one Linux machine is the point of the design, so a Linux checkout, a VM or a
container is enough; nothing needs a Mac or a Windows box. The script also
refuses to run outside the flake shell, which is what sets the pins.

## When something goes wrong

- **The workflow failed after the tag was pushed.** Re-run it from the Actions
  tab. The publish step is idempotent: where a release for the tag already
  exists it replaces that release's assets rather than failing, so a run that
  died partway through leaves nothing to clean up by hand. The re-run checks
  out the same tag, though, so a fix that has to reach the built code needs a
  new version. The tag cannot be moved.
- **The tag names a version the manifests do not carry.** The version check in
  `build-test` fails, which fails the gate, so the publish job never runs. Cut
  a new version.
- **A target stops cross-compiling.** `scripts/package-cli.sh --all` reproduces
  it on a Linux machine inside `nix develop`, and CI catches the host target on
  every pull request before a tag exists.
- **Something unrelated to the release failed the run.** One workflow means the
  whole gate stands between a tag and its release, so a Codecov upload that
  cannot reach the service, or a semgrep scan that cannot fetch its registry
  rules, fails `build-test` or `static-checks` and no release is created. That
  is the trade for having no second pipeline to drift. Re-run from the Actions
  tab once the service is back: the re-run is the recovery described above, and
  publishing is idempotent.
