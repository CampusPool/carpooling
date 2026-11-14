#!/usr/bin/env python3
"""Create synthetic, private, loopback-only stage secrets. Never print them."""
from pathlib import Path
import base64
import secrets
import os

ROOT = Path(__file__).resolve().parents[2]
target = ROOT / ".local/one-box/private.env"
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    print("Private test configuration already exists; preserving it.")
    raise SystemExit(0)
values = {
    "APP_NAME": "CampusPoolPrivateStage",
    "APP_ENV": "testing",
    "APP_DEBUG": "false",
    "APP_KEY": "base64:" + base64.b64encode(secrets.token_bytes(32)).decode(),
    "APP_URL": "http://127.0.0.1:18083",
    "DB_CONNECTION": "mysql",
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "3306",
    "DB_DATABASE": "carpoolear",
    "DB_USERNAME": "carpoolear",
    "DB_PASSWORD": secrets.token_hex(24),
    "DB_ROOT_PASSWORD": secrets.token_hex(24),
    "MONGO_ROOT_PASSWORD": secrets.token_hex(24),
    "MONGO_APP_PASSWORD": secrets.token_hex(24),
    "MOBILITY_ACTIVITY_SERVICE_KEY": secrets.token_hex(32),
    "ACTIVITY_READER_PASSWORD": secrets.token_hex(32),
    "JWT_SECRET": secrets.token_hex(32),
    "MOBILITY_COLLEGE_CODE": "CAMPUS-BLR",
    "MOBILITY_CAMPUS_CODES": "CAMPUS-BLR",
    "MOBILITY_PUBLIC_STUDENT_ONLY": "true",
    "MOBILITY_COHORT_REQUIRED": "true",
    "MOBILITY_PILOT_UI_ENABLED": "false",
    "MOBILITY_MAILPIT_MODE": "true",
    "MAIL_MAILER": "smtp",
    "MAIL_HOST": "127.0.0.1",
    "MAIL_PORT": "1025",
    "MAIL_FROM_ADDRESS": "noreply@campuspool.invalid",
    "QUEUE_CONNECTION": "sync",
    "CACHE_STORE": "file",
    "SESSION_DRIVER": "file",
    "IDENTITY_VALIDATION_ENABLED": "false",
    "MERCADO_PAGO_ACCESS_TOKEN": "smoke-placeholder",
    "MERCADO_PAGO_WEBHOOK_SECRET": "smoke-placeholder",
    "OSRM_ROUTER_BASE_URL": "http://127.0.0.1:9",
    "OPENROUTER_API_KEY": "",
    "BOX3_BUILD_PROXY": os.environ.get("BOX3_BUILD_PROXY", ""),
}
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as output:
    output.writelines(f"{key}={value}\n" for key, value in values.items())
print("Created private, testing-only credentials with file mode 0600.")
