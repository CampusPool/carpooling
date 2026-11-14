#!/usr/bin/env python3
"""Only grant the analytics projection SELECT on its eight required SQL columns."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / ".local/one-box/private.env"
values = dict(line.split("=", 1) for line in source.read_text().splitlines() if "=" in line)
if values.get("APP_ENV") != "testing" or values.get("MOBILITY_PUBLIC_STUDENT_ONLY") != "true":
    raise SystemExit("Refusing to provision outside the private testing stage.")
password = values["ACTIVITY_READER_PASSWORD"]
if not re.fullmatch(r"[0-9a-f]{64}", password):
    raise SystemExit("Invalid synthetic analytics SQL password.")
statements = []
for host in ("127.0.0.1", "localhost"):
    statements.extend([
        f"CREATE USER IF NOT EXISTS 'activity_reader'@'{host}' IDENTIFIED BY '{password}';",
        f"ALTER USER 'activity_reader'@'{host}' IDENTIFIED BY '{password}';",
        "GRANT SELECT (id,trip_id,actor_id,passenger_id,action,version,"
        f"response_status,created_at) ON carpoolear.mobility_trip_events TO 'activity_reader'@'{host}';",
    ])
statements.append("FLUSH PRIVILEGES;")
args = [
    "docker", "compose", "--env-file", str(source),
    "-f", str(ROOT / "deploy/one-box/compose.yml"),
    "exec", "-T", "mysql", "sh", "-c",
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot',
]
if subprocess.run(["docker","info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0:
    args = ["sudo", "-n", *args]
result = subprocess.run(args, input="\n".join(statements) + "\n", text=True,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
if result.returncode:
    raise SystemExit("Read-only SQL reader setup failed (details suppressed).")
print("Granted SQL reader access to only eight lifecycle-event columns.")
