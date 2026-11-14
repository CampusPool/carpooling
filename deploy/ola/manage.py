#!/usr/bin/env python3
"""Manage an independent, private Ola-only VPS staging deployment.

Does not change the legacy demo, reveal keys, seed synthetic logins, run PHPUnit
on a serving database, merge a PR, or remove Docker volumes.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.local/deploy/ola'
COMPOSE = ROOT / 'deploy/ola/compose.yml'
PROJECT = 'campuspool-ola-stage'
KEY_RE = re.compile(r'[A-Za-z0-9_-]{16,128}\Z')


def private_file(path: Path) -> None:
    if not path.is_file() or path.stat().st_mode & 0o077 or path.stat().st_size > 4096:
        raise ValueError(f'File must exist, be <=4096 bytes, and be mode-600: {path}')


def new_file(path: Path, content: str) -> None:
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)


def write_env(path: Path, items: dict[str, str]) -> None:
    for k, value in items.items():
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*', k) or not isinstance(value, str) or '\n' in value or '\r' in value:
            raise ValueError('Invalid environment configuration')
    new_file(path, ''.join(f'{k}={v}\n' for k, v in items.items()))


def init(key_file: Path, port: int, simular_host: bool = False) -> None:
    if not 1024 <= port <= 65535:
        raise ValueError('Local stage port must be 1024-65535')
    if STATE.exists():
        raise ValueError('A private stage configuration already exists; refusing to overwrite keys or database identity')
    key_file = key_file.resolve()
    private_file(key_file)
    config = json.loads(key_file.read_text())
    if config.get('kind') != 'ola_maps_demo':
        raise ValueError('Expected a private ola_maps_demo JSON configuration')
    key, browser = config.get('api_key'), config.get('browser_key')
    if not isinstance(key, str) or not KEY_RE.fullmatch(key):
        raise ValueError('Invalid server-side Ola key')
    if not isinstance(browser, str) or not KEY_RE.fullmatch(browser) or browser == key:
        raise ValueError('A separate, referrer-restricted Ola browser key is required; do not expose the server key')
    STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(STATE.parent, 0o700)
    STATE.mkdir(mode=0o700)
    db_password = secrets.token_urlsafe(30)
    app_name = 'carpoolear'
    url = f'http://127.0.0.1:{port}'
    app = {
        'APP_NAME': 'CampusPool', 'APP_ENV': 'local', 'APP_DEBUG': 'false',
        'APP_URL': url, 'APP_TIMEZONE': 'Asia/Kolkata',
        'APP_KEY': 'base64:' + base64.b64encode(secrets.token_bytes(32)).decode('ascii'),
        'DB_CONNECTION': 'mysql', 'DB_HOST': 'mysql', 'DB_PORT': '3306',
        'DB_DATABASE': app_name, 'DB_USERNAME': app_name, 'DB_PASSWORD': db_password,
        'QUEUE_CONNECTION': 'sync', 'CACHE_STORE': 'file', 'SESSION_DRIVER': 'file',
        'MAIL_MAILER': 'log', 'LOG_CHANNEL': 'stderr',
        'JWT_SECRET': secrets.token_hex(32),
        'MOBILITY_ROUTING_PROVIDER': 'ola', 'MOBILITY_EXTENSION_ROOT': '/opt/mobility-extension',
        'MOBILITY_ROUTING_PRICING_VERSION': 'local-core-v1',
        'MOBILITY_ROUTING_CAR_MINOR_PER_KM': '800',
        'MOBILITY_ROUTING_BIKE_MINOR_PER_KM': '400',
        'MOBILITY_ROUTING_SYNTHETIC_ONLY': 'false',
        'MOBILITY_COHORT_REQUIRED': 'true', 'MOBILITY_COLLEGE_CODE': 'SYNTHETIC-LOCAL',
        'MOBILITY_PILOT_UI_ENABLED': 'true', 'MOBILITY_FRONTEND_URL': url,
        'IDENTITY_VALIDATION_ENABLED': 'false',
        'MERCADO_PAGO_ACCESS_TOKEN': 'synthetic-placeholder',
        'MERCADO_PAGO_WEBHOOK_SECRET': 'synthetic-placeholder',
        'OLA_MAPS_API_KEY': key,
        'MOBILITY_PATCH_DIGEST': hashlib.sha256((ROOT / 'research/experiments/carpoolear/patches/critical-invariants.patch').read_bytes()).hexdigest(),
    }
    write_env(STATE / 'laravel.env', app)
    write_env(STATE / 'mysql.env', {
        'MYSQL_DATABASE': app_name, 'MYSQL_USER': app_name, 'MYSQL_PASSWORD': db_password,
        'MYSQL_ROOT_PASSWORD': secrets.token_urlsafe(32),
    })
    write_env(STATE / 'frontend.env', {
        'OLA_MAPS_API_KEY': key, 'OLA_MAPS_BROWSER_KEY': browser,
    })
    new_file(STATE / 'state.json', json.dumps({'project': PROJECT, 'provider': 'ola',
                                             'root': str(ROOT.resolve()), 'port': port,
                                             'network_mode': 'simular-host' if simular_host else 'private-bridge'}, indent=2) + '\n')
    write_env(STATE / 'compose-vars.env', {
        'CAMPUSPOOL_MYSQL_ENV': str((STATE / 'mysql.env').resolve()),
        'CAMPUSPOOL_LARAVEL_ENV': str((STATE / 'laravel.env').resolve()),
        'CAMPUSPOOL_FRONTEND_ENV': str((STATE / 'frontend.env').resolve()),
        'CAMPUSPOOL_STAGE_PORT': str(port),
        'CAMPUSPOOL_DOMAIN': 'invalid.example',
    })
    print('Created private Ola staging settings (mode 600), a fresh database identity and independent browser/server keys.')
    print('No API key, token, or database password was printed or committed.')


def validated_pair(key_file: Path) -> tuple[str, str]:
    """Never let an API server credential become a browser-visible SDK key."""
    private_file(key_file)
    config = json.loads(key_file.read_text())
    if config.get('kind') != 'ola_maps_demo':
        raise ValueError('Expected private ola_maps_demo JSON')
    server, browser = config.get('api_key'), config.get('browser_key')
    if not isinstance(server, str) or not KEY_RE.fullmatch(server):
        raise ValueError('Invalid private server key')
    if not isinstance(browser, str) or not KEY_RE.fullmatch(browser) or server == browser:
        raise ValueError('A distinct, referrer-restricted browser key is required')
    return server, browser


def rotate(key_file: Path) -> None:
    stage_env()
    server, browser = validated_pair(key_file.resolve())
    replacements = {
        'laravel.env': {'OLA_MAPS_API_KEY': server},
        'frontend.env': {'OLA_MAPS_API_KEY': server, 'OLA_MAPS_BROWSER_KEY': browser},
    }
    for name, fields in replacements.items():
        target = STATE / name
        values = {}
        for line in target.read_text().splitlines():
            key, sep, value = line.partition('=')
            if not sep or key in values:
                raise ValueError('Invalid existing stage env file; refusing credential rotation')
            values[key] = value
        if not set(fields).issubset(values):
            raise ValueError('Missing key fields in stage env file')
        values.update(fields)
        temporary = target.with_suffix(target.suffix + '.tmp')
        write_env(temporary, values)
        os.replace(temporary, target)
    print('Updated private server and distinct browser keys; restart stage to use them. No secrets printed.')


def stage_env() -> dict[str, str]:
    if not STATE.is_dir() or STATE.stat().st_mode & 0o077:
        raise ValueError('Run init first; private staging directory must be mode 700')
    for name in ('laravel.env', 'mysql.env', 'frontend.env', 'compose-vars.env', 'state.json'):
        private_file(STATE / name)
    state = json.loads((STATE / 'state.json').read_text())
    if state.get('project') != PROJECT or state.get('provider') != 'ola' or state.get('root') != str(ROOT.resolve()):
        raise ValueError('Staging identity changed; refusing to connect to a different project or provider')
    if state.get('network_mode', 'private-bridge') not in ('private-bridge', 'simular-host'):
        raise ValueError('Unknown network mode; refusing unsafe staging change')
    if not 1024 <= state.get('port', 0) <= 65535:
        raise ValueError('Invalid staging port')
    env = os.environ.copy()
    env.update(CAMPUSPOOL_MYSQL_ENV=str((STATE / 'mysql.env').resolve()),
               CAMPUSPOOL_LARAVEL_ENV=str((STATE / 'laravel.env').resolve()),
               CAMPUSPOOL_FRONTEND_ENV=str((STATE / 'frontend.env').resolve()),
               CAMPUSPOOL_STAGE_PORT=str(state['port']))
    # No provider credentials or DB secrets are passed as argv/build arguments.
    return env


def compose(args: list[str], env: dict[str, str], *, capture: bool = False) -> subprocess.CompletedProcess:
    driver = ['docker'] if os.access('/var/run/docker.sock', os.R_OK | os.W_OK) else ['sudo', '-n', 'docker']
    stage = json.loads((STATE / 'state.json').read_text())
    override = (['-f', str(ROOT / 'deploy/ola/compose.simular-host.yml')]
                if stage.get('network_mode') == 'simular-host' else [])
    return subprocess.run([*driver, 'compose', '--env-file', str(STATE / 'compose-vars.env'),
                           '-p', PROJECT, '-f', str(COMPOSE), *override, *args],
                          cwd=ROOT, env=env, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    setup = sub.add_parser('init', help='Create an isolated private stage config exactly once')
    setup.add_argument('--key-file', required=True, type=Path)
    setup.add_argument('--port', type=int, default=3040)
    setup.add_argument('--simular-host-network', action='store_true',
                       help='Only for isolated Simular boxes where Docker bridge is blocked')
    rotation = sub.add_parser('rotate-key', help='Update only the private Ola credentials without touching DB data')
    rotation.add_argument('--key-file', type=Path, required=True)
    for command in ('check', 'up', 'status', 'stop'):
        sub.add_parser(command)
    args = parser.parse_args()
    try:
        if args.command == 'init':
            init(args.key_file, args.port, args.simular_host_network)
            return 0
        if args.command == 'rotate-key':
            rotate(args.key_file)
            return 0
        env = stage_env()
        compose(['config', '--quiet'], env)
        if args.command == 'check':
            print('Ola staging Compose configuration valid. No containers started or API calls made.')
        elif args.command == 'up':
            # The pinned Carpoolear host is an external dependency, not silently rewritten.
            subprocess.run(['sh', 'scripts/prepare-carpoolear.sh'], cwd=ROOT, check=True, env=env)
            driver = ['docker'] if os.access('/var/run/docker.sock', os.R_OK | os.W_OK) else ['sudo', '-n', 'docker']
            existing = subprocess.run([*driver, 'volume', 'inspect', PROJECT + '_mysql-data'],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
            if existing and not (STATE / 'bootstrapped').exists():
                raise ValueError('Existing MySQL volume without a completed stage marker; inspect it before reuse')
            compose(['build', 'migrate', 'api-web', 'frontend'], env)
            compose(['up', '-d', '--wait', 'mysql', 'migrate', 'api', 'api-web', 'frontend'], env)
            if not (STATE / 'bootstrapped').exists():
                new_file(STATE / 'bootstrapped', 'provider=ola\nproject=' + PROJECT + '\n')
            print('Private VPS stage is running on loopback only. No public ingress was enabled.')
        elif args.command == 'status':
            compose(['ps'], env)
            endpoint = f'http://127.0.0.1:{env["CAMPUSPOOL_STAGE_PORT"]}/api/mobility/local-auth/config'
            try:
                with urllib.request.urlopen(endpoint, timeout=5) as response:
                    if response.status != 200:
                        raise ValueError('App HTTP check failed')
                print('Frontend and private backend API are responding.')
            except (OSError, urllib.error.HTTPError) as exc:
                print('HTTP readiness check failed:', type(exc).__name__)
                return 2
        elif args.command == 'stop':
            compose(['stop', 'frontend', 'api-web', 'api', 'mysql'], env)
            print('Stopped only the independent staging services. MySQL volume retained.')
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print('Stage operation failed:', error, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
