#!/usr/bin/env bash
# Read-only ancestry inventory for review. Never deletes a branch or rewrites Git history.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${1:-}" == "--help" ]]; then
  echo "Usage: bash scripts/audit-branches.sh [--refresh]"
  echo "--refresh fetches remote branch refs (read-only from GitHub). No deletion is performed."
  exit 0
fi
if [[ "${1:-}" == "--refresh" ]]; then
  git fetch --no-tags origin '+refs/heads/*:refs/remotes/origin/*'
elif [[ $# -gt 0 ]]; then
  printf 'Unrecognized argument: %s\n' "$1" >&2
  exit 2
fi

if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  echo "ERROR: shallow clone cannot calculate reliable ancestry. Fetch full history first: git fetch --unshallow origin" >&2
  exit 2
fi
if ! git show-ref --verify --quiet refs/remotes/origin/main; then
  echo "ERROR: missing origin/main. Run with --refresh." >&2
  exit 2
fi

printf 'branch\tshort_sha\tbehind_main\tahead_main\tclassification\n'
contained=0
divergent=0
ahead_only=0
while IFS=' ' read -r ref sha; do
  [[ -z "$ref" || "$ref" == "origin/main" || "$ref" == "origin/HEAD" || "$ref" == "origin" ]] && continue
  counts=$(git rev-list --left-right --count "origin/main...${ref}")
  behind=$(printf '%s' "$counts" | awk '{print $1}')
  ahead=$(printf '%s' "$counts" | awk '{print $2}')
  if [[ "$ahead" -eq 0 ]]; then
    classification='contained'
    contained=$((contained+1))
  elif [[ "$behind" -eq 0 ]]; then
    classification='ahead-of-main'
    ahead_only=$((ahead_only+1))
  else
    classification='divergent-review'
    divergent=$((divergent+1))
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "${ref#origin/}" "${sha:0:12}" "$behind" "$ahead" "$classification"
done < <(git for-each-ref --format='%(refname:short) %(objectname)' refs/remotes/origin)

printf '\nSummary: %d contained, %d divergent, %d ahead-of-main (plus main).\n' "$contained" "$divergent" "$ahead_only"
echo 'IMPORTANT: ancestry is not permission to delete. Review owners, PR state and external references first.'
