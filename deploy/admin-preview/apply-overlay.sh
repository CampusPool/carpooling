#!/usr/bin/env bash
set -euo pipefail
root=/workspace/campuspool
commit=492f5c30186a6b3a442be5c4c2deccd00c50db4e
source_url="https://raw.githubusercontent.com/CampusPool/carpooling/$commit"
[[ -f "$root/frontend-next/package.json" && -f "$root/.local/one-box/private.env" ]] || { echo 'Not the expected InstaBox 3 preview; no changes made'; exit 2; }
backup="$root/.local/admin-overlay-backup-$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$backup"
chmod 700 "$backup"
cp "$root/backend/extensions/carpoolear/routes/mobility.php" "$backup/mobility.php"
cp "$root/backend/extensions/carpoolear/Mobility/Identity/StudentIdentityBoundary.php" "$backup/StudentIdentityBoundary.php"
cp -a "$root/frontend-next/.next" "$backup/next-build"
echo "Rollback files preserved: $backup"
paths=(
  frontend-next/app/admin/page.tsx
  frontend-next/components/AdminConsole.tsx
  frontend-next/components/AdminConsole.module.css
  backend/extensions/carpoolear/Mobility/OperatorDatabaseHealthController.php
  backend/extensions/carpoolear/Mobility/OperatorPasswordController.php
)
for path in "${paths[@]}"; do
  target="$root/$path"
  mkdir -p "$(dirname "$target")"
  temp="$(mktemp "${target}.download.XXXXXX")"
  if ! curl --fail --location --silent --show-error --max-time 30 "$source_url/$path" -o "$temp"; then rm -f "$temp"; echo "Download failed: $path"; exit 3; fi
  mv "$temp" "$target"
done
python3 - "$root" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1])
r=root/'backend/extensions/carpoolear/routes/mobility.php'
s=r.read_text()
needle="Route::prefix('api')->middleware(['api', 'logged'])->group(function (): void {"
assert s.count(needle)==1
if 'OperatorPasswordController::class' not in s:
    s=s.replace(needle,'''// Password-only operator sign-in; independent of disabled public student/demo login.
Route::prefix('api/mobility/operator')->middleware('api')->group(function (): void {
    Route::post('login', [\\STS\\Mobility\\OperatorPasswordController::class, 'login']);
    Route::post('logout', [\\STS\\Mobility\\OperatorPasswordController::class, 'logout'])->middleware('auth:api');
});

'''+needle)
a="    Route::get('mobility/operator/analytics', [\\STS\\Mobility\\OperatorAnalyticsController::class, 'show']);"
assert s.count(a)==1
if 'mobility/operator/dbms/health' not in s:
    s=s.replace(a,a+"\n    Route::get('mobility/operator/dbms/health', [\\STS\\Mobility\\OperatorDatabaseHealthController::class, 'show']);")
r.write_text(s)
p=root/'backend/extensions/carpoolear/Mobility/Identity/StudentIdentityBoundary.php'
s=p.read_text()
needle="        if ($user !== null) {\n            $email = (string) ($user->email ?? '');"
if 'Staff operator APIs' not in s:
    assert s.count(needle)==1
    s=s.replace(needle,'''        if ($user !== null) {
            // Staff operator APIs still require active administrator authorization.
            if ($user->is_admin && $user->active && ! $user->banned
                && (str_starts_with($path, 'api/mobility/operator/')
                    || str_starts_with($path, 'api/admin/support/'))) {
                return $next($request);
            }
            $email = (string) ($user->email ?? '');''')
p.write_text(s)
print('Operator route and student identity boundary installed')
PY
docker exec campuspool-pes-box3-backend-1 php -l /opt/mobility-extension/Mobility/OperatorPasswordController.php
docker exec campuspool-pes-box3-backend-1 php -l /opt/mobility-extension/Mobility/OperatorDatabaseHealthController.php
docker exec campuspool-pes-box3-backend-1 php -l /opt/mobility-extension/Mobility/Identity/StudentIdentityBoundary.php
docker exec campuspool-pes-box3-backend-1 php -l /opt/mobility-extension/routes/mobility.php
printf 'Admin overlay staged. Backups: %s\n' "$backup"
