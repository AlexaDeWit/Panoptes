#!/usr/bin/env bash
# Select GitHub Actions cache ids to delete, for .github/workflows/cache-cleanup.yml.
# Reads one TSV row per cache on stdin, as `gh api .../actions/caches` produces it:
#
#     id<TAB>ref<TAB>key<TAB>created_at<TAB>size_in_bytes
#
# Writes the ids on stdout, most urgent first, and a reasoned line per id on stderr.
# Stdin to stdout is the whole interface, so a listing captured from the API or written
# by hand exercises the retention rules without deleting anything:
#
#     printf 'id\trefs/heads/main\tnix-Linux-%064d\t2026-09-08\t1574208472\n' 0 \
#       | KEEP_NIX=1 scripts/prune-caches.sh
#
# awk and sort alone, so it runs on a plain runner with no toolchain of its own.
set -euo pipefail

# The cache key prefixes this repository's workflows write: `nix-<OS>-<digest>` from
# .github/actions/setup-toolchain, plus any other prefix a job hands its
# nix-cache-prefix input; `pnpm-store-<OS>-<digest>`, restored by that action and saved
# by ci.yml's build-test job; and the entry the Nix installer action writes for itself.
# A new cache key anywhere in .github belongs here, or this sweep reaps its entries.
allowed_prefixes='nix-|pnpm-store-|determinatesystem-nix-installer-'

keep="${KEEP_PER_PREFIX:-2}"
# A `nix-*` epoch is about 1.4 GB where every other entry is under 50 MB, so the heavy
# prefix carries the whole quota and retains the current epoch alone.
keep_nix="${KEEP_NIX:-1}"
rows="$(cat)"

# Each arm emits "id<TAB>key<TAB>size<TAB>reason", most urgent first: off-main
# stragglers, then superseded epochs, then keys no workflow writes.
selected="$(
  printf '%s\n' "$rows" | awk -F'\t' '
    $1 != "" && $2 != "refs/heads/main" { print $1 "\t" $3 "\t" $5 "\toff-main straggler" }'

  printf '%s\n' "$rows" | awk -F'\t' '
      $1 == "" || $2 != "refs/heads/main" { next }
      {
        key = $3
        # Group every epoch of one logical cache under the key it varies from: strip
        # the trailing hex digest (a hashFiles hash here, a commit in another key
        # shape) and a trailing release version, in whichever of those it carries.
        prefix = key
        while (1) {
          if (prefix ~ /-v[0-9]+\.[0-9]+\.[0-9]+$/) { sub(/-v[0-9]+\.[0-9]+\.[0-9]+$/, "", prefix); continue }
          seg = prefix; sub(/.*-/, "", seg)
          if (seg ~ /^[0-9a-f]+$/ && length(seg) >= 16) { sub(/-[0-9a-f]+$/, "", prefix); continue }
          break
        }
        print prefix "\t" $4 "\t" $1 "\t" key "\t" $5
      }' \
    | LC_ALL=C sort -t$'\t' -k1,1 -k2,2r -k3,3r \
    | awk -F'\t' -v keep="$keep" -v keep_nix="$keep_nix" '
        $1 != prev { prev = $1; n = 0 }
        {
          k = ($1 ~ /^nix-/) ? keep_nix : keep
          if (++n > k) print $3 "\t" $4 "\t" $5 "\tsuperseded epoch of " $1
        }'

  printf '%s\n' "$rows" | awk -F'\t' -v allowed="^($allowed_prefixes)" '
    $1 == "" || $2 != "refs/heads/main" { next }
    $3 !~ allowed { print $1 "\t" $3 "\t" $5 "\tno workflow writes this key" }'
)"

printf '%s\n' "$selected" | awk -F'\t' '
  $1 == "" || seen[$1]++ { next }
  { printf "prune: %8.1f MB  %s  (%s)\n", $3 / 1048576, $2, $4 > "/dev/stderr"
    print $1 }'
