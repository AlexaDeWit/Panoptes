#!/usr/bin/env bash
# Compile release binaries offline. See docs/release.md for runtime pins and rebuilds.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
cd -- "${repo_root}"

readonly bundle='apps/cli/dist/saer.js'
readonly assets='apps/cli/dist/assets'
readonly out_dir='dist/cli'

export DENO_NO_UPDATE_CHECK=1
export DENO_NO_PROMPT=1

readonly all_targets=(
  x86_64-unknown-linux-gnu
  aarch64-unknown-linux-gnu
  x86_64-apple-darwin
  aarch64-apple-darwin
  x86_64-pc-windows-msvc
)

readonly unshare_bin="${SAERSKRIVEN_UNSHARE:-unshare}"
if ! command -v -- "${unshare_bin}" >/dev/null 2>&1; then
  echo "no unshare at '${unshare_bin}'. A network namespace is a Linux" >&2
  echo "facility, so this script does not run on macOS or Windows: compile" >&2
  echo "on Linux, or in a Linux container." >&2
  exit 1
fi
if ! "${unshare_bin}" -rn true >/dev/null 2>&1; then
  echo "'${unshare_bin} -rn' cannot create a network namespace here." >&2
  echo "Refusing to compile with the network reachable: the runtime deno" >&2
  echo "embeds has to come from the flake's pins, not from dl.deno.land." >&2
  echo "Ubuntu 24.04 and its like deny this through the sysctl" >&2
  echo "kernel.apparmor_restrict_unprivileged_userns, which the workflow" >&2
  echo "clears before it compiles." >&2
  exit 1
fi

if [ -z "${SAERSKRIVEN_DENORT_CACHE-}" ]; then
  echo "SAERSKRIVEN_DENORT_CACHE is unset, so nothing pins the runtime deno" >&2
  echo "embeds. Run this inside the flake shell, which sets it:" >&2
  echo "  nix develop .#ci --command $0${1+ $1}" >&2
  exit 1
fi

scratch="$(mktemp -d)"
readonly scratch
readonly repeat_dir="${scratch}/cli-repeat"
trap 'rm -rf -- "${scratch}"' EXIT

# Deno needs writable caches around the pinned, read-only runtime downloads.
deno_dir="${scratch}/deno"
readonly deno_dir
mkdir -p -- "${deno_dir}"
ln -s -- "${SAERSKRIVEN_DENORT_CACHE}/dl" "${deno_dir}/dl"
export DENO_DIR="${deno_dir}"

host_target="$(deno eval 'console.log(Deno.build.target)')"
readonly host_target
deno_version="$(deno eval 'console.log(Deno.version.deno)')"
readonly deno_version

targets=("${host_target}")
if [ "${1-}" = '--all' ]; then
  targets=("${all_targets[@]}")
elif [ "$#" -ne 0 ]; then
  echo "usage: $0 [--all]" >&2
  exit 2
fi

for target in "${targets[@]}"; do
  pinned="${SAERSKRIVEN_DENORT_CACHE}/dl/release/v${deno_version}/denort-${target}.zip"
  if [ ! -e "${pinned}" ]; then
    echo "no pinned denort runtime for ${target} at ${pinned}." >&2
    echo "Add its hash to denortHashes in flake.nix; the compile fetches" >&2
    echo "nothing." >&2
    exit 1
  fi
done

if [ ! -f "${bundle}" ]; then
  echo "no bundle at ${bundle}: run 'nx build @saerskriven/cli' first" >&2
  exit 1
fi

if [ ! -d "${assets}" ]; then
  echo "no assets at ${assets}: run 'nx build @saerskriven/cli' first" >&2
  exit 1
fi

version="$(node -p 'require("./package.json").version')"
readonly version

# Deno embeds file times and modes. Fix both for repeatable bytes (#106).
stamp_staged() {
  find "$1" -type d -exec chmod 755 -- {} +
  find "$1" -type f -exec chmod 644 -- {} +
  find "$1" -depth -exec touch -m -d '@0' -- {} +
}

# import.meta.dirname locates assets beside the entry point.
stage_into() {
  mkdir -p -- "$1"
  cp -- "${bundle}" "$1/saer.js"
  cp -R -- "${assets}" "$1/assets"
}

readonly staged="${scratch}/first"
readonly repeat_staged="${scratch}/repeat"
stage_into "${staged}"
stage_into "${repeat_staged}"

# Vary the second input metadata to detect a missing stamp.
find "${repeat_staged}" -type f -exec chmod 700 -- {} +
find "${repeat_staged}" -depth -exec touch -m -d '@1000000000' -- {} +

stamp_staged "${staged}"
stamp_staged "${repeat_staged}"

compile_into() {
  local target="$1"
  local tree="$2"
  local output="$3"

  "${unshare_bin}" -rn deno compile \
    --quiet \
    --no-config \
    --no-lock \
    --no-remote \
    --no-npm \
    --cached-only \
    --allow-read \
    --allow-write \
    --allow-env \
    --include "${tree}/assets" \
    --target "${target}" \
    --output "${output}" \
    "${tree}/saer.js"
}

rm -rf -- "${out_dir}" "${repeat_dir}"
mkdir -p -- "${out_dir}" "${repeat_dir}"

for target in "${targets[@]}"; do
  name="saer-${version}-${target}"
  case "${target}" in
    *-windows-*) name="${name}.exe" ;;
  esac

  echo "compiling ${name}"
  compile_into "${target}" "${staged}" "${out_dir}/${name}"
  compile_into "${target}" "${repeat_staged}" "${repeat_dir}/${name}"

  first="$(sha256sum <"${out_dir}/${name}" | cut -d ' ' -f 1)"
  second="$(sha256sum <"${repeat_dir}/${name}" | cut -d ' ' -f 1)"
  if [ "${first}" != "${second}" ]; then
    echo "${name} is not reproducible: one bundle staged twice, once with" >&2
    echo "another time and mode, gave ${first} and ${second}." >&2
    exit 1
  fi
done

rm -rf -- "${repeat_dir}"

(cd -- "${out_dir}" && sha256sum -- saer-* >SHA256SUMS)

readonly host_binary="${out_dir}/saer-${version}-${host_target}"
if [ ! -x "${host_binary}" ]; then
  echo "no executable at ${host_binary} to run: this host's target" >&2
  echo "(${host_target}) is not one deno compiled, so nothing checked the" >&2
  echo "version any of these executables report" >&2
  exit 1
fi

reported="$("${host_binary}" --version)"
if [ "${reported}" != "${version}" ]; then
  echo "the executable reports ${reported}, the workspace carries ${version}" >&2
  exit 1
fi

readonly fixture='test-data/ecluse.json'
summary="$("${host_binary}" validate "${fixture}")"
readonly summary

# Rendering detects a missing embedded Typst module that validation cannot catch.
readonly pdf_check="${scratch}/pdf-check.pdf"
"${host_binary}" render "${fixture}" --format pdf --out "${pdf_check}"
pdf_header="$(head -c 5 -- "${pdf_check}")"
readonly pdf_header
if [ "${pdf_header}" != '%PDF-' ]; then
  echo "saer render --format pdf wrote a file opening '${pdf_header}'," >&2
  echo "not a PDF. The executable carries no working Typst compiler." >&2
  exit 1
fi

# The same for the embedded resvg module, which the PDF check does not reach.
readonly png_check="${scratch}/png-check.png"
"${host_binary}" render "${fixture}" --format png --out "${png_check}"
png_header="$(head -c 8 -- "${png_check}" | od -An -tx1 | tr -d ' \n')"
readonly png_header
if [ "${png_header}" != '89504e470d0a1a0a' ]; then
  echo "saer render --format png wrote a file opening '${png_header}'," >&2
  echo "not a PNG. The executable carries no working rasterizer." >&2
  exit 1
fi

echo "saer --version reports ${reported}, saer validate ${fixture}"
echo "reports ${summary}, saer render writes a PDF and a PNG, and"
echo "every target compiled twice to the same bytes"

# Log input hashes to locate differences when rebuilding a release.
sha256sum -- "${bundle}" "${assets}"/*.ttf \
  "${assets}"/LICENSE.liberation-fonts.txt
cat -- "${out_dir}/SHA256SUMS"
