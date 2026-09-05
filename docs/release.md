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
  discipline rather than a wall; the three above are the wall, and the shape of
  this procedure follows from them.
- **Tag Creation** restricts who may create a tag and names the admin role as
  its bypass, because the owner has to be able to cut one. It is a separate
  ruleset on purpose: a bypass in one ruleset does not bypass another, so Tag
  Integrity's empty list keeps standing over the same tags.

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

### 3. Check dependency provenance (owner, no credentials)

On the merge commit, before the tag exists:

```sh
git switch main && git pull --ff-only
nix develop --command scripts/check-provenance.mjs
```

The check reads the catalog's resolved versions out of `pnpm-lock.yaml`,
verifies each package's npm provenance attestation against the sigstore trust
root, and compares what verifies against
[`dependency-provenance.txt`](../dependency-provenance.txt), which records
each attested package beside the source repository its attestation names. It
fails where a package that carried an attestation no longer does, where the
attestation now names a different repository, where a signature or an
attestation does not verify, where a package carries no registry signature
though the registry publishes signing keys, and where the record and the
catalog have parted. Every one of those is accepted, once read, by rerunning
with `--update` and committing the diff. The packages that publish no
attestation at all are printed as the residual: that list is what a release
accepts, and it is the residual Panoptes' own threat model names.

The CI gate runs the same check, on this tag as on every pull request, so this
run is the one that answers before a tag exists that cannot be moved. It
reaches the registry, and an exit code of 2 says the check could not run
rather than that provenance failed: the registry was out of reach after two
attempts, or `pnpm-lock.yaml` or the record could not be read, or the catalog
holds a name npm would refuse, a version the workspace's own importers do not
resolve `catalog:` to, or an entry no workspace project references at all.
Only the first of those is worth running again; the rest name what to
correct.

### 4. Cut and push the signed tag (owner, GPG key)

On the merge commit, and nowhere else:

```sh
git switch main && git pull --ff-only
git show --stat HEAD                  # confirm this is the release merge
git tag -s "v<version>" -m "v<version>"
git push origin "v<version>"
```

`-s` is required: an unsigned tag is rejected by the ruleset. The tag cannot be
moved or deleted afterwards, so check the commit before pushing.

### 5. The executables are built and attached (automatic, no credentials)

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
jobs and its verdict do not change on a tag. Two jobs hang off it, both on a
`v*` ref alone. **attest** takes the artifact and records a build provenance
attestation over every executable and over `SHA256SUMS`. **publish** waits for
that, then creates or updates the GitHub release with the same files. So a
release exists only where the whole gate was green on that tag, and nothing is
attached before it is attested.

Neither job installs or compiles anything, so no write permission sits beside
a dependency tree, and neither job's permissions exist on a run that is not a
tag. Publish holds `contents: write` and nothing else. Attest holds the two
the attestation needs, `id-token: write` for the OIDC identity it is signed
against and `attestations: write` to record it, plus `contents: read`. No job
reads a secret: the workflow's own `GITHUB_TOKEN` is what talks to the release
API. Publish also names the `release` environment, whose deployment policy
admits `v*` tags only; the section below records that and the rest of the
configuration. If `CHANGELOG.md` has no section for the version, the notes
fall back to GitHub's generated ones rather than failing, because a tag cannot
be moved and a stopped release would leave the version unshippable.

### 6. Check what shipped (owner)

Download one executable from the release page, verify it against
`SHA256SUMS`, check its provenance with both flags, and run
`panoptes --version`:

```sh
gh attestation verify panoptes-* --repo AlexaDeWit/Panoptes \
  --signer-workflow AlexaDeWit/Panoptes/.github/workflows/ci.yml
```

The
[README's install section](../README.md#install) is the instruction a user
follows, so following it is the test of it.

## What the rules guarantee, and what they cannot

GitHub has no single switch that forbids a release from outside CI, so the
guarantee is assembled from rules that are each verifiable (issue #114). The
repository settings among them are applied. This section records what is
configured, and the commands that check it has not drifted.

- **Tag Integrity** requires a signature on every tag and forbids deleting,
  updating or force-moving one, with an empty bypass list.
- **Tag Creation** restricts who may create a tag, naming the admin role as
  its bypass because the owner has to be able to cut one. It is a second
  ruleset on purpose: rulesets are additive and a bypass in one does not
  bypass another, so the owner can create tags while nobody, admin included,
  can move, delete or unsign one. The bypass names a role because the rulesets
  API has no `User` actor type; role id 5 is admin, which here is the owner.
- The **`release` environment**, which `ci.yml`'s publish job names, admits
  `v*` tags and nothing else. That is defence in depth rather than the control
  itself: the jobs already test the ref and the event, and the policy is what
  still holds if a future edit to those conditions is wrong. No required
  reviewer is set, so a green gate publishes without a human click; adding one
  would put the owner between the gate and a public release.
- Every asset carries a **build provenance attestation** from the `attest`
  job, which needs no repository setting and which a stranger can check. The
  [README's install section](../README.md#install) has the command and what
  its two flags do and do not enforce.

### Checking the configuration has not drifted

Each command is followed by what it printed on 2026-09-04, with the settings
applied.

```sh
for id in $(gh api repos/AlexaDeWit/Panoptes/rulesets \
              --jq '.[] | select(.target == "tag") | .id'); do
  gh api "repos/AlexaDeWit/Panoptes/rulesets/$id" \
    --jq '{name, rules: [.rules[].type], bypass_actors}'
done
```

```
{"bypass_actors":[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"always"}],"name":"Tag Creation","rules":["creation"]}
{"bypass_actors":[],"name":"Tag Integrity","rules":["deletion","non_fast_forward","update","required_signatures"]}
```

Tag Integrity's empty bypass is the part to watch: a bypass actor there, or a
`creation` rule, would mean the two rulesets had been folded together.

```sh
gh api repos/AlexaDeWit/Panoptes/environments/release \
  --jq '{name, protection_rules: [.protection_rules[].type],
         deployment_branch_policy}'
gh api \
  repos/AlexaDeWit/Panoptes/environments/release/deployment-branch-policies \
  --jq '[.branch_policies[] | {id, name, type}]'
```

```
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"release","protection_rules":["branch_policy"]}
[{"id":59133693,"name":"v*","type":"tag"}]
```

`protection_rules` holding `branch_policy` alone is what says no reviewer is
required; a `required_reviewers` entry would appear there.

```sh
gh api repos/AlexaDeWit/Panoptes/actions/permissions/workflow \
  --jq '{default_workflow_permissions, can_approve_pull_request_reviews}'
```

```
{"can_approve_pull_request_reviews":false,"default_workflow_permissions":"read"}
```

A workflow token therefore starts read-only, so the `contents: write` on
publish is the only write any job in `ci.yml` holds.

### What none of this can do

A collaborator with write access can still create a release object through the
API and attach anything to it. No GitHub rule prevents that. What the rules
give is narrower: write access is the owner's alone and tag creation with it,
a release from this pipeline exists only where the gate was green on a tag the
owner signed and pushed, and every genuine asset is attested, so an imposter
is distinguishable by anyone rather than only by us.

`ci.yml` accepts `workflow_dispatch`, and both tag jobs once tested the ref
alone, so a dispatch aimed at an existing `v*` tag could re-drive attest and
publish with no push behind them. Both now require
`github.event_name == 'push'` as well, so a dispatch runs the checks and
stops.

Immutable releases, the fourth rule #114 proposed, is conditioned there on the
setting being available on this plan; it is not, so assets can still be
replaced after a release is published and `upload --clobber` keeps working.

The attestation is the part that does not depend on these settings staying as
they are, which is why the README teaches it rather than the checksum alone.

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
- **The output is a function of the bundle's bytes and the staged name, time
  and mode.** `deno compile` records the entry file's name, modification time
  and executable bit in the virtual file system it embeds, so the script
  copies the bundle to a fixed `main.js`, stamps it to the epoch and to mode
  644, and compiles that. It then compiles every target into two directories
  and fails unless the two are byte for byte the same, on a pull request as
  well as on a release, staging the repeat copy with another time and mode on
  purpose so that comparison reds where a stamp is dropped instead of agreeing
  with itself.

The staged entry is the one host-dependent input left at these pins, and it is
worth a dozen bytes rather than five thousand: the time is ASCII digits inside
one JSON record, so two machines building on the same day give executables of
equal size differing in the last few digits (#106). The pair of sizes the issue
records, 5,077 bytes apart, is not reproducible from one bundle and traces to
two builds of two different bundles on the release branch. Nothing else about
the host is embedded: not the entry's directory, and not a user, host or clock,
none of which appear in the metadata deno writes beside the file system. The
one host property that metadata does carry is `vfs_case_sensitivity`, deno's
probe of the filesystem it compiled on, which every Linux checkout reports as
`s`. A case-insensitive mount would change it, which is a residual worth
knowing rather than one the script can stamp away.

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

## Rebuilding a released executable

The executables are a function of the commit, so the same tag rebuilt on any
Linux machine inside the flake gives the SHA-256 the release page carries.
Anyone can run this:

```sh
git switch --detach "v<version>"
nix develop --command pnpm install --frozen-lockfile
nix develop --command pnpm nx build @panoptes/cli
nix develop --command scripts/package-cli.sh
```

The default shell is enough: `flake.nix` puts `denortEnv` in both shells, so
the default one sets the denort pins the script refuses to run without, and
the `.#ci` its refusal names is the shell CI happens to enter rather than the
only one that works.

The script's last lines are the bundle's SHA-256 and then the `SHA256SUMS` it
wrote for the executables. Compare the host target's line with the release's
`SHA256SUMS`. Every CI run prints the same two things, so a runner build and a
local build can be compared from the logs alone, without downloading either.

A mismatch belongs to one of the two steps, and the bundle's hash says which.
A bundle hash that already differs puts it in the esbuild build: the checkout
is not the tag, or the toolchain is not the flake's. A matching bundle under a
differing executable puts it in `deno compile`: the denort pins moved, or
something environment-dependent has reached the output again.

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
- **A dependency lost its provenance attestation, or moved to another source
  repository.** The `provenance` job fails and with it the gate, so nothing is
  published. Read what the check printed: either the package moved, in which
  case the catalog entry is the decision to make and `--update` is how the move
  is accepted, or the registry is answering wrongly and the release waits.
- **Something unrelated to the release failed the run.** One workflow means the
  whole gate stands between a tag and its release, so a Codecov upload that
  cannot reach the service, a semgrep scan that cannot fetch its registry
  rules, or a provenance check that cannot reach the npm registry, fails
  `build-test`, `static-checks` or `provenance` and no release is created. That
  is the trade for having no second pipeline to drift. Re-run from the Actions
  tab once the service is back: the re-run is the recovery described above, and
  publishing is idempotent.
