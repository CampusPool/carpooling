"""No-network safety tests for the isolated cloud staging launcher."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest

FILE = Path(__file__).resolve().parents[1] / 'manage.py'


class OlaStageSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        spec = importlib.util.spec_from_file_location('ola_stage_under_test', FILE)
        self.manager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.manager)
        self.root = Path(self.tmp.name)
        self.manager.ROOT = self.root
        self.manager.STATE = self.root / '.local/deploy/ola'
        self.manager.COMPOSE = self.root / 'deploy/ola/compose.yml'
        patch = self.root / 'research/experiments/carpoolear/patches/critical-invariants.patch'
        patch.parent.mkdir(parents=True)
        patch.write_bytes(b'fake-fixture-patch')
        self.key = self.root / 'ola.json'

    def write_key(self, api='A'*32, browser='B'*32, mode=0o600):
        self.key.write_text(json.dumps({'kind': 'ola_maps_demo', 'api_key': api, 'browser_key': browser}))
        self.key.chmod(mode)

    def test_init_creates_independent_private_keys_and_env_files(self):
        self.write_key()
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            self.manager.init(self.key, 3040)
        folder = self.manager.STATE
        self.assertEqual(stat.S_IMODE(folder.stat().st_mode), 0o700)
        for name in ('laravel.env', 'mysql.env', 'frontend.env', 'compose-vars.env', 'state.json'):
            p = folder / name
            self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        laravel = (folder / 'laravel.env').read_text()
        frontend = (folder / 'frontend.env').read_text()
        self.assertIn('APP_ENV=local\n', laravel)
        self.assertIn('APP_DEBUG=false\n', laravel)
        self.assertIn('MOBILITY_ROUTING_PROVIDER=ola\n', laravel)
        self.assertIn('OLA_MAPS_API_KEY=' + 'A'*32, laravel)
        self.assertIn('OLA_MAPS_BROWSER_KEY=' + 'B'*32, frontend)
        self.assertNotIn('A'*32, printed.getvalue())
        self.assertNotIn('B'*32, printed.getvalue())
        self.assertNotIn('A'*32, (folder / 'state.json').read_text())
        self.assertNotIn('A'*32, (folder / 'compose-vars.env').read_text())
        self.assertEqual(self.manager.stage_env()['CAMPUSPOOL_STAGE_PORT'], '3040')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.manager.init(self.key, 3040)

    def test_rotate_keys_preserves_database_password_and_laravel_identity(self):
        self.write_key()
        with contextlib.redirect_stdout(io.StringIO()):
            self.manager.init(self.key, 3040)
        private = self.manager.STATE
        original_mysql = (private / 'mysql.env').read_bytes()
        original_state = (private / 'state.json').read_bytes()
        self.write_key(api='C'*32, browser='D'*32)
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            self.manager.rotate(self.key)
        self.assertEqual((private / 'mysql.env').read_bytes(), original_mysql)
        self.assertEqual((private / 'state.json').read_bytes(), original_state)
        self.assertIn('OLA_MAPS_API_KEY=' + 'C'*32, (private / 'laravel.env').read_text())
        self.assertIn('OLA_MAPS_BROWSER_KEY=' + 'D'*32, (private / 'frontend.env').read_text())
        self.assertEqual(stat.S_IMODE((private / 'frontend.env').stat().st_mode), 0o600)
        self.assertNotIn('C'*32, printed.getvalue())
        self.assertNotIn('D'*32, printed.getvalue())

    def test_simular_host_network_is_explicit_opt_in(self):
        self.write_key()
        with contextlib.redirect_stdout(io.StringIO()):
            self.manager.init(self.key, 3040, simular_host=True)
        state = json.loads((self.manager.STATE / 'state.json').read_text())
        self.assertEqual(state['network_mode'], 'simular-host')

    def test_reject_same_server_and_browser_key(self):
        self.write_key(browser='A'*32)
        with self.assertRaisesRegex(ValueError, 'separate'):
            self.manager.init(self.key, 3040)
        self.assertFalse(self.manager.STATE.exists())

    def test_reject_world_readable_key_and_invalid_port(self):
        self.write_key(mode=0o644)
        with self.assertRaisesRegex(ValueError, 'mode-600'):
            self.manager.init(self.key, 3040)
        self.key.chmod(0o600)
        with self.assertRaisesRegex(ValueError, 'port'):
            self.manager.init(self.key, 80)

    def test_prevent_db_cross_checkout_or_provider_reuse(self):
        self.write_key()
        with contextlib.redirect_stdout(io.StringIO()):
            self.manager.init(self.key, 3040)
        p = self.manager.STATE / 'state.json'
        state = json.loads(p.read_text())
        state['provider'] = 'osrm'
        p.write_text(json.dumps(state))
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            self.manager.stage_env()
        state['provider'] = 'ola'
        state['root'] = '/different/checkout'
        p.write_text(json.dumps(state))
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            self.manager.stage_env()


if __name__ == '__main__':
    unittest.main()
