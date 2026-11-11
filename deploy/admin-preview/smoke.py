"""Private localhost smoke checks for the preview admin password and live APIs.

Read the operator secret only from the private Box 3 file; never print it or JWTs.
No ride, seat, membership, or payment records are changed.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = 'http://127.0.0.1:3013'
PW_FILE = Path('/workspace/campuspool/.local/one-box/admin-access-password.txt')


def fetch(path, method='GET', body=None, token=None):
    headers = {'Accept': 'application/json'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.status, response.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode('utf-8', errors='replace')


def assert_status(label, path, expected, method='GET', body=None, token=None):
    status, raw = fetch(path, method=method, body=body, token=token)
    passed = status in expected
    print(f'{"PASS" if passed else "FAIL"}: {label} HTTP {status} (wanted {expected})')
    if not passed:
        sys.exit(1)
    try:
        return json.loads(raw)
    except ValueError:
        return raw


if __name__ == '__main__':
    page = assert_status('admin page served', '/admin', (200,))
    assert 'Administrator sign in' in page and 'Administrator password' in page
    assert_status('student homepage preserved', '/', (200,))
    config = assert_status('student identity config', '/api/mobility/college-auth/config', (200,))
    assert config.get('student_only') is True
    assert_status('old demo login remains disabled', '/api/login', (404,), 'POST', {})
    assert_status('admin reports denied anonymously', '/api/mobility/operator/dashboard', (401, 403))
    assert_status('incorrect operator password rejected', '/api/mobility/operator/login', (401,), 'POST', {'password': 'incorrect-synthetic-test-password'})
    secret = PW_FILE.read_text().strip()
    answer = assert_status('operator password accepted', '/api/mobility/operator/login', (200,), 'POST', {'password': secret})
    token = answer.get('token')
    assert isinstance(token, str) and len(token) >= 30
    assert_status('authorized operations overview', '/api/mobility/operator/dashboard', (200,), token=token)
    assert_status('authorized SQL object metadata', '/api/mobility/operator/dbms/health', (200,), token=token)
    assert_status('authorized analytics report', '/api/mobility/operator/analytics?days=7', (200,), token=token)
    assert_status('authorized member registry', '/api/mobility/operator/memberships?page_size=100', (200,), token=token)
    assert_status('operator logout', '/api/mobility/operator/logout', (200,), 'POST', {}, token)
    assert_status('revoked token rejected', '/api/mobility/operator/dashboard', (401, 403), token=token)
    print('PRIVATE_ADMIN_SMOKE_PASS: no credentials printed')
