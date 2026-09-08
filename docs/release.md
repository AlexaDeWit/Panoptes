# Cutting a release

The procedure for shipping a version of Saerskriven: what the version number is,
who moves it, and what turns it into downloadable executables.

## What decides the version

One number for the whole workspace. The root [`package.json`](../package.json)
carries it, every project's manifest carries the same one, and the CLI build
stamps it into the executable, so `saerskriven --version` and the tag cannot
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
RELEASE_VERSION=v<version> DRY_RUN=1 nix develop --command pnpm nx run release-tools:prepare
RELEASE_VERSION=v<version> nix develop --command pnpm nx run release-tools:prepare
```

The dry run shows the bump Nx derives from the commit history. The full run
writes that version into every manifest, refreshes `pnpm-lock.yaml`, and writes
the changelog. It then formats the generated changelog and checks the whole
tree's formatting. Read both diffs: the changelog is what users will see on the
release page.

Then run the local check, as for any change:

```sh
pnpm check
```

### 2. Land it on main (owner, no credentials)

Open a pull request in the usual way and merge it once the gate is green. Give
it a `chore(release): v<version>` title: it is the squash subject, and a
`chore` subject asks for no further bump.

### 3. Rehearse the guarded release (owner, GitHub CLI)

On the merge commit, before the tag exists:

```sh
git switch main && git pull --ff-only
RELEASE_VERSION=v<version> DRY_RUN=1 nix develop --command pnpm nx run release-tools:tag
```

The script refuses unless every manifest carries the stated version, the tree
is clean, `HEAD` is `origin/main`, and both required checks passed on that
commit. It also requires Tag Integrity to hold its full rule set with an empty
bypass list. Restore any temporary recovery bypass before this check. The tool
refuses if the tag exists locally or on the remote. It then runs the dependency
provenance check and prints the commit it cleared. The dry run creates and
pushes nothing.

The provenance check reads the catalog's resolved versions out of `pnpm-lock.yaml`,
verifies each package's npm provenance attestation against the sigstore trust
root, and reads the source repository out of what verifies. Its baseline is
git rather than a committed record: it reads the same catalog out of `HEAD^`'s
lockfile, audits on both sides the packages whose version moved, and fails
where one that carried an attestation on the base commit no longer does, where
the attestation now names a different repository, where a signature or an
attestation does not verify, and where a package carries no registry signature
though the registry publishes signing keys. `--base <ref>` compares against
another commit. A move that is a real change of home is accepted in the body of
the commit that makes it, as a `Provenance-Move: name old-repository
new-repository` trailer, one line per package, read out of the commits between
the base and the head: the declaration arrives for review beside the bump it
explains, and it admits the move it names and no other. The line is read
wherever the squash left it, since a squash merge concatenates the branch's
commit messages and the declaration lands in the middle of what reaches main.
Nothing is committed beyond that: the packages that publish no attestation at
all are printed as the residual, and that list is what a release accepts and
what Saerskriven's own threat model names.

The CI gate runs the same check on this tag, and on a pull request whenever
`pnpm-lock.yaml` or `pnpm-workspace.yaml` changed, which is where a bump
appears. This step runs it whatever this commit's own diff touched, so a tag
that cannot be moved is never cut on an unanswered question. Run it in an
installed checkout: it parses both lockfiles with the catalog's `yaml`. It
reaches the registry, and an exit code of 2 says the check could not run
rather than that provenance failed: the registry was out of reach after two
attempts, or the lockfile at either commit could not be read, or the commits
between the base and the head could not be read, or a `Provenance-Move:` line
is not three fields, or the catalog holds a name npm would refuse, a version
the workspace's own importers do not resolve `catalog:` to, or an entry no
workspace project references at all. Only the first of those is worth running
again; the rest name what to correct.

### 4. Cut and push the signed tag (owner, GPG key and GitHub CLI)

Run the same tool without `DRY_RUN`:

```sh
RELEASE_VERSION=v<version> nix develop --command pnpm nx run release-tools:tag
```

The tool repeats every check, creates the signed tag on the cleared commit,
verifies its signature, and asks you to type the tag before it pushes. It
removes the local tag if any later check or the confirmation fails. The pushed
tag cannot be moved or deleted.

### 5. Build, attest, publish, and deploy (automatic)

Pushing the tag runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
It runs the same CI gate as a pull request, compiles every CLI target, and
checks the executable version against the tag.

After the gate passes, `pages-build` builds the website from that exact tag.
It takes the Pages base path and site URL from GitHub and stamps the workspace
version into the browser bundle and `version.json`. It compares every project
manifest and the built version with the tag before creating `studio.tar` and
`studio-release.json`. The latter records the source commit and CI run.

`attest` waits for the gate and website build. It attests the CLI executables,
`SHA256SUMS`, and both website assets. `publish` waits for those jobs and creates
or updates the release with their files. A failed gate, website build, or
attestation prevents publication. Neither attest nor publish installs
dependencies. The `release` environment still permits only `v*` tags.
A tag containing a prerelease suffix creates a prerelease, which cannot reach
production Pages. Release notes use the changelog section, or GitHub's generated
notes when the section is missing.

#### Website promotion and recovery

After publication, `pages-prepare` and `pages-deploy` run in the same
[CI workflow](../.github/workflows/ci.yml). Automatic deployment uses that run's
tag and archive. If another release supersedes it as Latest, it skips the old
deployment. There is no separate Pages workflow or cross-workflow dispatch.

Promotion verifies both website assets' attestations against this repository,
`ci.yml`, the release tag, and its exact source commit. It checks the source
run's tag-push identity and its latest completed gate, website-build,
attestation, and publication jobs. It does not wait for the whole run, which
includes this deployment. A failed deployment can therefore retry after the
release stages succeeded. Preparation holds read permissions. Deployment
holds `pages: write` and `id-token: write`, without installing dependencies.

The `github-pages` concurrency group serializes deployments. The deployment
job rechecks Latest after any queue or environment approval wait. An older
run cannot overwrite a newer deployment. GitHub can replace a pending job
when another enters the group, so retry a cancelled deployment as described
below. Publication and deployment are separate GitHub operations within one
run. The previous website remains visible during promotion or after failure.

For the first release, select **GitHub Actions** as the Pages source and set
the intended custom domain before tagging. The `github-pages` environment must
allow `v*` tags for automatic releases and `main` for manual retries. The
separate `release` environment remains restricted to tags. Check the Pages
policy with:

```sh
gh api repos/AlexaDeWit/Saerskriven/environments/github-pages/deployment-branch-policies
```

Cut a new release containing these workflows through the guarded procedure
above. A pre-existing release without website assets cannot bootstrap this
pipeline. Drafts and prereleases do not bootstrap a production site either.

If Pages fails after publication, rerun its failed jobs while the staged
artifact exists, or dispatch CI from `main` with the deployment-only option:

```sh
gh workflow run ci.yml --repo AlexaDeWit/Saerskriven --ref main -f deploy_pages=true
```

This mode skips the build, check, and publication jobs. Its skipped gate uses
a different check name to preserve the last CI verdict on `main`. It resolves Latest
again and reuses its attested release assets,
including after the temporary Actions artifacts expire. Missing assets or a
failed attestation stop promotion. A code fix or a changed Pages domain/base
path requires a new release. Do not substitute a build from current `main`.

After deployment, a bounded check requests `version.json` with cache bypass
parameters and compares it with the promoted tag. A stale response keeps the
run failed until a retry sees the expected version. Verify the Project menu in
a fresh browser load too. Existing tabs retain their loaded version and
unsaved work. The studio neither relabels an older bundle from the release API
nor forces an editor reload.

### 6. Check what shipped (owner)

Download one executable from the release page, verify it against
`SHA256SUMS`, check its provenance with both flags, and run
`saerskriven --version`:

```sh
gh attestation verify saerskriven-* --repo AlexaDeWit/Saerskriven \
  --signer-workflow AlexaDeWit/Saerskriven/.github/workflows/ci.yml
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
for id in $(gh api repos/AlexaDeWit/Saerskriven/rulesets \
              --jq '.[] | select(.target == "tag") | .id'); do
  gh api "repos/AlexaDeWit/Saerskriven/rulesets/$id" \
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
gh api repos/AlexaDeWit/Saerskriven/environments/release \
  --jq '{name, protection_rules: [.protection_rules[].type],
         deployment_branch_policy}'
gh api \
  repos/AlexaDeWit/Saerskriven/environments/release/deployment-branch-policies \
  --jq '[.branch_policies[] | {id, name, type}]'
```

```
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"release","protection_rules":["branch_policy"]}
[{"id":59133693,"name":"v*","type":"tag"}]
```

`protection_rules` holding `branch_policy` alone is what says no reviewer is
required; a `required_reviewers` entry would appear there.

```sh
gh api repos/AlexaDeWit/Saerskriven/actions/permissions/workflow \
  --jq '{default_workflow_permissions, can_approve_pull_request_reviews}'
```

```
{"can_approve_pull_request_reviews":false,"default_workflow_permissions":"read"}
```

A workflow token starts read-only. `publish` adds release writes.
`attest` adds attestation and OIDC writes. `pages-deploy` adds Pages and OIDC
writes. Build jobs do not receive release
or Pages deployment permissions.

### What none of this can do

A collaborator with write access can still create a release object through the
API and attach anything to it. No GitHub rule prevents that. What the rules
give is narrower: write access is the owner's alone and tag creation with it,
a release from this pipeline exists only where the gate was green on a tag the
owner signed and pushed, and every genuine asset is attested, so an imposter
is distinguishable by anyone rather than only by us.

`ci.yml` accepts `workflow_dispatch`. Publication still requires
`github.event_name == 'push'` and a tag ref. An ordinary dispatch runs checks
without publishing. The `deploy_pages` option runs only deployment and only
from `main`, using an existing attested stable release.

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
- **The fonts come from a pin too.** The five Liberation faces a PDF is
  typeset with are not committed: `apps/cli/esbuild.config.mts` copies them
  into `apps/cli/dist/assets` from `SAERSKRIVEN_FONTS_DIR`, which both dev shells
  export from the pinned nixpkgs' `liberation_ttf`, so their provenance is the
  `nixpkgs` revision in `flake.lock`. `scripts/package-cli.sh` prints each
  staged font's SHA-256, and their licence's, beside the bundle's, so a
  nixpkgs bump that redraws a glyph or replaces the licence file is visible in
  a run's log rather than only in an executable's bytes.
- **A compile has no network.** `scripts/package-cli.sh` runs every
  `deno compile` under `unshare -rn`, passes `--no-remote`, `--no-npm` and
  `--cached-only`, and refuses to run where no network namespace can be made.
  The workflow sets `DENO_NO_UPDATE_CHECK` and `DENO_NO_PROMPT`. A runtime
  that is not pinned therefore fails the compile; it cannot become a download.
- **The output is a function of the staged tree's bytes, names, times and
  modes.** `deno compile` records every embedded file's name, modification
  time and executable bit in the virtual file system it embeds, so the script
  stages what it compiles into a directory of its own: the bundle as a fixed
  `main.js`, and beside it the assets an executable carries, the Typst
  WebAssembly module and the fonts. It stamps every file there to the epoch
  and to mode 644, every directory to mode 755, and compiles that. It then
  compiles every target into two directories and fails unless the two are byte
  for byte the same, on a pull request as well as on a release, staging the
  repeat tree with another time and mode on purpose so that comparison reds
  where a stamp is dropped instead of agreeing with itself.

The staged tree is the one host-dependent input left at these pins, and it is
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
`nix develop --command pnpm nx compile @saerskriven/cli --configuration=all`
and confirm it compiles offline. A new target needs an entry there before the
script will build it. The script refuses a missing pin.

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
nix develop --command pnpm nx compile @saerskriven/cli
```

The default shell is enough: `flake.nix` puts `denortEnv` and `shellEnv` in
both shells, so the default one sets the denort pins the script refuses to run
without and the font path the build refuses to run without, and the `.#ci` the
refusals name is the shell CI happens to enter rather than the only one that
works.

The script's last lines are the bundle's SHA-256, then each staged font's and
their licence's, then the `SHA256SUMS` it wrote for the executables. Compare the host target's line
with the release's `SHA256SUMS`. Every CI run prints the same things, so a
runner build and a local build can be compared from the logs alone, without
downloading either.

A mismatch belongs to one of the steps, and the hashes printed above the sums
say which. A bundle hash that already differs puts it in the esbuild build:
the checkout is not the tag, or the toolchain is not the flake's. A font hash
that differs puts it in the flake's nixpkgs revision, which is the fonts' only
pin and reaches the executable without touching the bundle. A matching bundle
and matching fonts under a differing executable puts it in `deno compile`: the
denort pins moved, or something environment-dependent has reached the output
again.

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
- **A target stops cross-compiling.** Run
  `pnpm nx compile @saerskriven/cli --configuration=all` on Linux inside
  `nix develop`. CI checks the host target on every pull request.
- **A dependency lost its provenance attestation, or moved to another source
  repository.** The `provenance` job fails and with it the gate, so nothing is
  published. Read what the check printed: either the move is one this project
  takes, in which case a `Provenance-Move:` trailer on the commit that makes it
  accepts that move and no other, or the registry is answering wrongly and the
  release waits.
- **Something unrelated to the release failed the run.** One workflow means the
  whole gate stands between a tag and its release, so a Codecov upload that
  cannot reach the service, a semgrep scan that cannot fetch its registry
  rules, or a provenance check that cannot reach the npm registry, fails
  `build-test`, `static-checks` or `provenance` and no release is created. That
  is the trade for having no second pipeline to drift. Re-run from the Actions
  tab once the service is back: the re-run is the recovery described above, and
  publishing is idempotent.
