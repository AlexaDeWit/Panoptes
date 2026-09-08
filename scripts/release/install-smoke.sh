#!/usr/bin/env bash
set -euo pipefail

# CI supplies the packaged assets. Only transport is replaced in this smoke check.
assets="$(cd cli && pwd)"
expected="$(jq -r .version package.json)"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/tools" "$scratch/home/.local/bin"
export INSTALL_SMOKE_ASSETS="$assets"
cat >"$scratch/tools/curl" <<'EOF'
#!/bin/bash
set -eu
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) url="$1"; shift ;;
  esac
done
cp "$INSTALL_SMOKE_ASSETS/${url##*/}" "$output"
if [ "${INSTALL_SMOKE_CORRUPT:-false}" = true ]; then printf 'corrupt\n' >>"$output"; fi
EOF
chmod +x "$scratch/tools/curl"
export PATH="$scratch/tools:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="$scratch/home"
destination="$HOME/.local/bin/saer"
compatibility="$HOME/.local/bin/saerskriven"
printf 'previous version\n' >"$compatibility"
# /bin/bash selects the system shell, including macOS Bash 3.2.
/bin/bash "$assets/install.sh"
first="$("$destination" --version)"
[ "$first" = "$expected" ]
[ ! -L "$destination" ]
[ "$(readlink "$compatibility")" = saer ]
[ "$("$compatibility" --version)" = "$expected" ]
/bin/bash "$assets/install.sh"
[ "$("$destination" --version)" = "$first" ]
[ "$("$compatibility" --version)" = "$first" ]
if INSTALL_SMOKE_CORRUPT=true /bin/bash "$assets/install.sh"; then
  echo 'The installer accepted a corrupted executable.' >&2
  exit 1
fi
[ "$("$destination" --version)" = "$first" ]
printf 'Native installer smoke passed for %s on %s.\n' "$first" "$(uname -s)"
