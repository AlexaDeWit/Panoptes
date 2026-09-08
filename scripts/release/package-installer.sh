#!/usr/bin/env bash
set -euo pipefail

version="$(jq -er .version package.json)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || {
  echo 'The workspace version is not a release version.' >&2
  exit 1
}
template="$(dirname -- "${BASH_SOURCE[0]}")/install.sh"
for asset in dist/cli/saerskriven-*; do
  [[ "${asset##*/}" =~ ^[a-zA-Z0-9._-]+$ ]] || {
    echo "Invalid release asset name: $asset" >&2
    exit 1
  }
done
(cd dist/cli && sha256sum -- saerskriven-* >SHA256SUMS)
awk -v tag="v$version" -v sums=dist/cli/SHA256SUMS '
  $0 == "@RELEASE_SHA256SUMS@" {
    while ((getline line < sums) > 0) print line
    next
  }
  { gsub(/@RELEASE_TAG@/, tag); print }
' "$template" >dist/cli/install.sh
bash -n dist/cli/install.sh
(cd dist/cli && sha256sum -- install.sh >>SHA256SUMS)
