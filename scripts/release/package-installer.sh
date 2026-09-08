#!/usr/bin/env bash
set -euo pipefail

version="$(jq -er .version package.json)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || {
  echo 'The workspace version is not a release version.' >&2
  exit 1
}
template="$(dirname -- "${BASH_SOURCE[0]}")/install.sh"
sed "s/@RELEASE_TAG@/v${version}/g" "$template" >dist/cli/install.sh
bash -n dist/cli/install.sh
(cd dist/cli && sha256sum -- saerskriven-* install.sh >SHA256SUMS)
