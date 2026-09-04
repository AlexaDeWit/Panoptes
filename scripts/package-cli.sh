#!/usr/bin/env bash
# Compile the CLI bundle into the standalone executables a release attaches.
#
#   scripts/package-cli.sh          the host target alone (what CI runs per PR)
#   scripts/package-cli.sh --all    every target a release carries
#
# Input is apps/cli/dist/main.js, which `nx build @panoptes/cli` writes.
# Output is dist/cli/panoptes-<version>-<target>[.exe] and SHA256SUMS beside
# them. The host executable is then run with --version and its output compared
# with the workspace version, so a bundle deno cannot compile, or an executable
# that cannot report its own version, fails here rather than at release time.
#
# Linux only: the compile runs in a network namespace, which is a Linux
# facility. Nothing may be fetched, so this script needs the flake's pinned
# denort runtimes and refuses to run without them. The maintenance section of
# docs/release.md explains why and how to bump the pins.
#
# Deno is a packaging tool only: --no-config and --no-lock keep it from
# discovering any configuration, and it never resolves the pnpm workspace.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
cd -- "${repo_root}"

readonly bundle='apps/cli/dist/main.js'
readonly out_dir='dist/cli'
readonly repeat_dir='dist/cli-repeat'

# No update check, and no interactive prompt to hang a run.
export DENO_NO_UPDATE_CHECK=1
export DENO_NO_PROMPT=1

# Every target deno 2.8 cross-compiles to, from any one of them.
readonly all_targets=(
  x86_64-unknown-linux-gnu
  aarch64-unknown-linux-gnu
  x86_64-apple-darwin
  aarch64-apple-darwin
  x86_64-pc-windows-msvc
)

# util-linux from the flake where the flake is in play, the host's otherwise.
readonly unshare_bin="${PANOPTES_UNSHARE:-unshare}"
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

# The pinned runtimes are not optional: without them deno would compile
# against whatever a warm DENO_DIR happens to hold, or fetch.
if [ -z "${PANOPTES_DENORT_CACHE-}" ]; then
  echo "PANOPTES_DENORT_CACHE is unset, so nothing pins the runtime deno" >&2
  echo "embeds. Run this inside the flake shell, which sets it:" >&2
  echo "  nix develop .#ci --command $0${1+ $1}" >&2
  exit 1
fi

# Deno writes its own caches into DENO_DIR and the flake's pinned runtimes sit
# on a read-only store path, so DENO_DIR is a writable directory with the
# store's dl/ tree linked in, rather than 160 MB of zips copied. It is set
# before deno runs at all, so no invocation here touches the host's own cache.
deno_dir="$(mktemp -d)"
readonly deno_dir
trap 'rm -rf -- "${deno_dir}"' EXIT
ln -s -- "${PANOPTES_DENORT_CACHE}/dl" "${deno_dir}/dl"
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
  pinned="${PANOPTES_DENORT_CACHE}/dl/release/v${deno_version}/denort-${target}.zip"
  if [ ! -e "${pinned}" ]; then
    echo "no pinned denort runtime for ${target} at ${pinned}." >&2
    echo "Add its hash to denortHashes in flake.nix; the compile fetches" >&2
    echo "nothing." >&2
    exit 1
  fi
done

if [ ! -f "${bundle}" ]; then
  echo "no bundle at ${bundle}: run 'nx build @panoptes/cli' first" >&2
  exit 1
fi

version="$(node -p 'require("./package.json").version')"
readonly version

compile_into() {
  local target="$1"
  local output="$2"

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
    --target "${target}" \
    --output "${output}" \
    "${bundle}"
}

rm -rf -- "${out_dir}" "${repeat_dir}"
mkdir -p -- "${out_dir}" "${repeat_dir}"

for target in "${targets[@]}"; do
  name="panoptes-${version}-${target}"
  case "${target}" in
    *-windows-*) name="${name}.exe" ;;
  esac

  echo "compiling ${name}"
  compile_into "${target}" "${out_dir}/${name}"
  compile_into "${target}" "${repeat_dir}/${name}"

  first="$(sha256sum <"${out_dir}/${name}" | cut -d ' ' -f 1)"
  second="$(sha256sum <"${repeat_dir}/${name}" | cut -d ' ' -f 1)"
  if [ "${first}" != "${second}" ]; then
    echo "${name} is not reproducible: two compiles of one bundle gave" >&2
    echo "${first} and ${second}." >&2
    exit 1
  fi
done

rm -rf -- "${repeat_dir}"

(cd -- "${out_dir}" && sha256sum -- panoptes-* >SHA256SUMS)

readonly host_binary="${out_dir}/panoptes-${version}-${host_target}"
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
echo "panoptes --version reports ${reported}, and every target compiled twice"
echo "to the same bytes"

ls -l -- "${out_dir}"
