#!/usr/bin/env bash
set -euo pipefail

readonly release_tag='@RELEASE_TAG@'
readonly repository='AlexaDeWit/Saerskriven'
readonly release_checksums='
@RELEASE_SHA256SUMS@
'

fail() {
  printf 'Install failed: %s\n' "$*" >&2
  exit 1
}

main() {
  local bin_dir="${HOME:?HOME is unset}/.local/bin"
  local attest=false
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --bin-dir)
        [ "$#" -ge 2 ] || fail '--bin-dir needs an absolute directory.'
        bin_dir="$2"
        shift 2
        ;;
      --verify-attestation) attest=true; shift ;;
      --help)
        printf '%s\n' \
          'Usage: bash install.sh [--bin-dir /absolute/path] [--verify-attestation]' \
          "Installs ${release_tag} to \$HOME/.local/bin by default." \
          'Checks SHA-256 before replacing an existing executable.' \
          '--verify-attestation also requires gh and verifies the release build origin.'
        return
        ;;
      *) fail "Unknown argument: $1" ;;
    esac
  done
  [ "$(id -u)" != 0 ] || fail 'Run as your own user, without sudo.'
  case "$bin_dir" in
    /*) ;;
    *) fail '--bin-dir must be an absolute directory.' ;;
  esac
  [[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] ||
    fail 'Download the release installer. This source template has no release tag.'

  local os arch target
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux) target=unknown-linux-gnu ;;
    Darwin) target=apple-darwin ;;
    *) fail "Unsupported operating system: $os. This installer supports macOS and Linux." ;;
  esac
  case "$arch" in
    x86_64|amd64) arch=x86_64 ;;
    arm64|aarch64) arch=aarch64 ;;
    *) fail "Unsupported architecture: $arch. Use a 64-bit Intel, AMD, or ARM system." ;;
  esac

  local checksum_command
  if command -v sha256sum >/dev/null 2>&1; then
    checksum_command=(sha256sum)
  elif command -v shasum >/dev/null 2>&1; then
    checksum_command=(shasum -a 256)
  else
    fail 'Install sha256sum or shasum before running this installer.'
  fi
  command -v curl >/dev/null 2>&1 || fail 'Install curl before running this installer.'
  if "$attest"; then
    command -v gh >/dev/null 2>&1 || fail '--verify-attestation requires the GitHub CLI (gh).'
  fi

  local asset="saerskriven-${release_tag#v}-${arch}-${target}"
  local base_url="https://github.com/${repository}/releases/download/${release_tag}"
  umask 077
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/saerskriven-install.XXXXXXXX")"
  local expected actual
  expected="$(awk -v name="$asset" '
    $NF == name {
      count++
      hash = substr($0, 1, 64)
      if ($0 != hash "  " name || hash !~ /^[0-9a-f]+$/ || length(hash) != 64) bad = 1
    }
    END {
      if (count != 1 || bad) exit 1
      print hash
    }
  ' <<<"$release_checksums")" || fail "Expected exactly one SHA-256 entry for $asset."
  download "$base_url/$asset" "$scratch/$asset"
  actual="$("${checksum_command[@]}" <"$scratch/$asset")"
  actual="${actual%% *}"
  [ "$actual" = "$expected" ] || fail "SHA-256 mismatch for $asset."
  if "$attest"; then
    gh attestation verify "$scratch/$asset" --repo "$repository" \
      --signer-workflow "$repository/.github/workflows/ci.yml" \
      --source-ref "refs/tags/$release_tag" || fail 'Release attestation verification failed.'
  fi

  mkdir -p "$bin_dir"
  local destination="$bin_dir/saerskriven"
  [ ! -L "$destination" ] || fail "Refusing to replace a symbolic link: $destination"
  if [ -e "$destination" ] && [ ! -f "$destination" ]; then
    fail "The destination is not a regular file: $destination"
  fi
  # Stage on the destination filesystem so replacement is a single rename.
  staging="$(mktemp -d "$bin_dir/.saerskriven-install.XXXXXXXX")"
  cp "$scratch/$asset" "$staging/saerskriven"
  chmod 755 "$staging/saerskriven"
  mv -f "$staging/saerskriven" "$destination"
  printf 'Installed %s to %s (SHA-256 verified).\n' "$release_tag" "$destination"
  case ":${PATH-}:" in
    *:"$bin_dir":*) ;;
    *) printf 'Add %s to PATH in your shell configuration, then open a new terminal.\n' "$bin_dir" ;;
  esac
}

download() {
  curl -q --fail --silent --show-error --location \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --connect-timeout 15 --max-time 300 --retry 2 \
    --output "$2" "$1" || fail "Download failed: $1"
}

cleanup() {
  if [ -n "$staging" ]; then rm -rf -- "$staging"; fi
  if [ -n "$scratch" ]; then rm -rf -- "$scratch"; fi
}

scratch=''
staging=''
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A piped, truncated download cannot call main before its definition is complete.
main "$@"
