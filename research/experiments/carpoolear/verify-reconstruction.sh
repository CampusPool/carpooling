#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
revision=6ba3d8913a8f77e664e848a526f196690a03c1e8
tmp=$(mktemp -d "${TMPDIR:-/tmp}/mobility-carpoolear-reconstruction.XXXXXX")
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT INT TERM

git clone --quiet https://github.com/STS-Rosario/carpoolear_backend.git "$tmp/source"
git -C "$tmp/source" checkout --quiet --detach "$revision"
git -C "$tmp/source" diff --quiet HEAD --
if git -C "$tmp/source" status --porcelain --untracked-files=all | grep .; then exit 1; fi
git -C "$tmp/source" worktree add --quiet --detach "$tmp/hardened" "$revision"

python3 "$root/scripts/apply-carpoolear-patches.py" "$tmp/hardened" \
  "$root/research/experiments/carpoolear/patches/critical-invariants.patch" \
  "$root/backend/integrations/carpoolear/lifecycle-integration.patch" \
  "$root/backend/integrations/carpoolear/cohort-integration.patch" \
  "$root/backend/integrations/carpoolear/routing-integration.patch" \
  "$root/backend/integrations/carpoolear/recurrence-integration.patch" \
  "$root/backend/integrations/carpoolear/segments-integration.patch" \
  "$root/backend/integrations/carpoolear/dispatch-integration.patch" \
  "$root/backend/integrations/carpoolear/dispatch-immediate-integration.patch" \
  "$root/backend/integrations/carpoolear/support-privacy-integration.patch" \
  "$root/backend/integrations/carpoolear/private-endpoints-integration.patch" \
  "$root/backend/integrations/carpoolear/driver-profile-integration.patch" \
  "$root/backend/integrations/carpoolear/driver-reservations-integration.patch" \
  "$root/backend/integrations/carpoolear/private-scheduled-integration.patch"

changed=$(git -C "$tmp/hardened" diff --name-only | wc -l | tr -d ' ')
[ "$changed" -gt 0 ]
printf '%s\n' "reconstruction passed: upstream $revision; changed files $changed; no application or database services started"
