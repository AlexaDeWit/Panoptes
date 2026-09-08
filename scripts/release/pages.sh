#!/usr/bin/env bash
set -euo pipefail

# The build runs in Nix. Promotion uses only the runner's gh, jq, and tar.
mode=${1:?expected prepare, resolve, check, or verify-live}
repository=${GH_REPO:?GH_REPO must name the repository}

latest() {
  local release object
  release=$(gh api "repos/$repository/releases/latest")
  tag=$(jq -er 'select(.draft == false and .prerelease == false) | .tag_name' <<<"$release")
  [[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || {
    echo 'Latest must name a stable vX.Y.Z release.' >&2
    exit 1
  }
  object=$(gh api "repos/$repository/git/ref/tags/$tag" --jq '.object | select(.type == "tag") | .sha')
  [[ "$object" =~ ^[0-9a-f]{40}$ ]] || exit 1
  commit=$(gh api "repos/$repository/git/tags/$object" --jq '.object | select(.type == "commit") | .sha')
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
}

case "$mode" in
  prepare)
    tag=${SAERSKRIVEN_RELEASE_TAG:?missing release tag}
    commit=${GITHUB_SHA:?missing source commit}
    run_id=${GITHUB_RUN_ID:?missing source run}
    [[ "$commit" =~ ^[0-9a-f]{40}$ && "$run_id" =~ ^[1-9][0-9]*$ ]] || exit 1
    version=$(node --input-type=module <<'JS'
import { Either } from 'effect';
import { readWorkspaceVersion } from './scripts/release/release.mts';
const result = readWorkspaceVersion(process.cwd());
if (Either.isLeft(result)) {
  console.error(JSON.stringify(result.left));
  process.exit(1);
}
process.stdout.write(result.right);
JS
    )
    [[ "$tag" == "v$version" ]] || {
      echo 'Release tag and workspace version disagree.' >&2
      exit 1
    }
    jq -e --arg tag "$tag" --arg version "$version" \
      '.tag == $tag and .version == $version' apps/studio/dist/version.json >/dev/null
    mkdir -p release-site
    jq -n --arg tag "$tag" --arg version "$version" --arg commit "$commit" \
      --arg repository "$repository" --argjson run_id "$run_id" \
      '{tag: $tag, version: $version, commit: $commit, repository: $repository, run_id: $run_id}' \
      >release-site/studio-release.json
    tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
      --dereference --hard-dereference --directory=apps/studio/dist \
      -cf release-site/studio.tar .
    ;;
  resolve)
    latest
    if [[ -n "${EXPECTED_TAG:-}" && "$tag" != "$EXPECTED_TAG" ]]; then
      echo 'The tagged release is no longer Latest. Skipping its deployment.'
      echo 'eligible=false' >>"${GITHUB_OUTPUT:?missing output file}"
      exit 0
    fi
    mkdir -p release-site
    gh release download "$tag" --repo "$repository" --dir release-site \
      --pattern studio.tar --pattern studio-release.json
    for asset in release-site/studio.tar release-site/studio-release.json; do
      gh attestation verify "$asset" --repo "$repository" \
        --signer-workflow "$repository/.github/workflows/ci.yml" \
        --source-ref "refs/tags/$tag" --source-digest "$commit"
    done
    jq -e --arg tag "$tag" --arg commit "$commit" --arg repository "$repository" \
      '.tag == $tag and .version == ($tag | ltrimstr("v")) and .commit == $commit
       and .repository == $repository and (.run_id | type == "number" and . > 0 and . == floor)' \
      release-site/studio-release.json >/dev/null
    run_id=$(jq -r '.run_id' release-site/studio-release.json)
    source_run=$(gh api "repos/$repository/actions/runs/$run_id")
    jq -e --arg tag "$tag" --arg commit "$commit" --arg repository "$repository" \
      '.event == "push" and .path == ".github/workflows/ci.yml" and .head_branch == $tag
       and .head_sha == $commit and .repository.full_name == $repository' \
      <<<"$source_run" >/dev/null
    # This run includes deployment, so validate its completed prerequisites.
    # Keep only the latest job per name when a failed stage was retried.
    source_jobs=$(gh api "repos/$repository/actions/runs/$run_id/jobs?filter=all&per_page=100" --paginate --slurp)
    jq -e '
      [.[].jobs[]] | group_by(.name) | map(max_by(.id)) as $jobs |
      all(["CI gate", "Build the release website", "Attest the release assets", "Publish the release"][];
        . as $name | any($jobs[]; .name == $name and .status == "completed" and .conclusion == "success"))
    ' <<<"$source_jobs" >/dev/null
    mv release-site/studio.tar release-site/artifact.tar
    {
      echo 'eligible=true'
      echo "tag=$tag"
      echo "commit=$commit"
    } >>"${GITHUB_OUTPUT:?missing output file}"
    ;;
  check)
    latest
    [[ "$tag" == "${EXPECTED_TAG:?missing expected tag}" && "$commit" == "${EXPECTED_COMMIT:?missing expected commit}" ]] || {
      echo 'Latest changed before deployment. Refusing this promotion.' >&2
      exit 1
    }
    ;;
  verify-live)
    site_url=${SITE_URL:?missing site URL}
    for attempt in {1..12}; do
      if curl --fail --silent --show-error --max-time 10 \
        --header 'Cache-Control: no-cache' \
        "${site_url%/}/version.json?release=${EXPECTED_TAG:?missing expected tag}&attempt=$attempt" \
        | jq -e --arg tag "$EXPECTED_TAG" '.tag == $tag and .version == ($tag | ltrimstr("v"))' >/dev/null; then
        exit 0
      fi
      sleep 10
    done
    echo 'The deployed version did not reach the public site within the verification window.' >&2
    exit 1
    ;;
  *)
    echo "Unknown Pages operation: $mode" >&2
    exit 1
    ;;
esac
