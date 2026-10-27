#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test -f "$root/app/src/main/AndroidManifest.xml"
grep -q 'FOREGROUND_SERVICE_LOCATION' "$root/app/src/main/AndroidManifest.xml"
grep -q 'foregroundServiceType="location"' "$root/app/src/main/AndroidManifest.xml"
grep -q 'ACCESS_COARSE_LOCATION' "$root/app/src/main/AndroidManifest.xml"
grep -q '"/api/login"' "$root/app/src/main/java/com/mobility/demo/tracking/MainActivity.java"
grep -q '"/api/users/me"' "$root/app/src/main/java/com/mobility/demo/tracking/MainActivity.java"
grep -q '"/api/users/my-trips"' "$root/app/src/main/java/com/mobility/demo/tracking/MainActivity.java"
grep -q 'postStop(String base,String tripId,String oldSession,String token)' "$root/app/src/main/java/com/mobility/demo/tracking/TrackingService.java"
grep -q 'session_id' "$root/app/src/main/java/com/mobility/demo/tracking/TrackingService.java"
grep -q 'prepareContext' "$root/app/src/main/java/com/mobility/demo/tracking/QueueStore.java"
grep -q 'bindSession' "$root/app/src/main/java/com/mobility/demo/tracking/QueueStore.java"
grep -q 'Allow notifications before sharing can start' "$root/app/src/main/java/com/mobility/demo/tracking/MainActivity.java"
if rg -n 'bearer token|access_token|TRUSTED_HANDOFF|HandoffActivity' "$root/app/src/main/java"; then exit 1; fi
grep -q 'Idempotency-Key' "$root/app/src/main/java/com/mobility/demo/tracking/TrackingService.java"
grep -q 'code==410' "$root/app/src/main/java/com/mobility/demo/tracking/TrackingService.java"
grep -q 'MAX_ITEMS = 100' "$root/app/src/main/java/com/mobility/demo/tracking/QueueStore.java"
if rg -n 'AIza|Bearer [A-Za-z0-9._-]{20,}|access_token=[^" ]+' "$root" --glob '!README.md' --glob '!**/static-check.sh'; then
  echo 'possible credential literal found' >&2; exit 1
fi
echo 'android companion static checks passed'
