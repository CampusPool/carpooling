#!/bin/sh
set -eu
mobility_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$mobility_root/scripts/mobility-runtime.sh"
mobility_vendor="$mobility_root/research/vendor/carpoolear_backend"
mobility_hardened="$mobility_root/research/vendor/carpoolear_hardened"
mobility_revision=6ba3d8913a8f77e664e848a526f196690a03c1e8
mobility_require_command git
mkdir -p "$mobility_root/research/vendor"
if [ ! -d "$mobility_vendor" ]; then
  git clone https://github.com/STS-Rosario/carpoolear_backend.git "$mobility_vendor"
  git -C "$mobility_vendor" checkout --detach "$mobility_revision"
fi
if [ "$(git -C "$mobility_vendor" rev-parse HEAD)" != "$mobility_revision" ]; then
  printf '%s\n' 'Existing vendor checkout differs from the pinned revision; inspect it before proceeding.' >&2
  exit 2
fi
if ! git -C "$mobility_vendor" diff HEAD --exit-code --quiet; then
  printf '%s\n' 'Pinned vendor checkout has tracked changes; inspect it before proceeding.' >&2
  exit 2
fi
if [ -n "$(git -C "$mobility_vendor" status --porcelain --untracked-files=all)" ]; then
  printf '%s\n' 'Pinned vendor checkout has untracked content; preserve or remove it explicitly before proceeding.' >&2
  git -C "$mobility_vendor" status --short --untracked-files=all >&2
  exit 2
fi
if [ ! -d "$mobility_hardened" ]; then
  git -C "$mobility_vendor" worktree add --detach "$mobility_hardened" "$mobility_revision"
fi
if [ "$(git -C "$mobility_hardened" rev-parse HEAD)" != "$mobility_revision" ]; then
  printf '%s\n' 'Existing integration worktree has another revision; inspect it before proceeding.' >&2
  exit 2
fi
mobility_require_command python3
python3 "$mobility_root/scripts/apply-carpoolear-patches.py" "$mobility_hardened" \
  "$mobility_root/research/experiments/carpoolear/patches/critical-invariants.patch" \
  "$mobility_root/backend/integrations/carpoolear/lifecycle-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/cohort-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/routing-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/recurrence-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/segments-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/dispatch-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/dispatch-immediate-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/support-privacy-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/private-endpoints-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/driver-profile-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/driver-reservations-integration.patch" \
  "$mobility_root/backend/integrations/carpoolear/private-scheduled-integration.patch"
printf '%s\n' 'Prepared the integration worktree. Original vendor sources were preserved.'
printf '%s\n' 'Run: sh research/experiments/carpoolear/run-smoke.sh lifecycle'
