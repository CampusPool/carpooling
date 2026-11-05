"""Restart regressions use temporary state and mocked Docker, never real data."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load("local_core", "run-local-core.py")
router = load("road_router", "mobility-road-router.py")


class ManagedRestartTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / "state.json"
        self.args = dict(root=Path("/checkout"), project="mobility-core-review",
                         context="colima-review", volume="review-db",
                         volume_exists=True, dependency_volume_exists=True)
        self.saved = {key: str(value) for key, value in self.args.items()
                      if key in {"root", "project", "context", "volume"}}

    def save(self, value=None):
        self.state.write_text(json.dumps(self.saved if value is None else value))

    def test_new_project_is_not_treated_as_restart(self):
        self.assertFalse(core.managed_restart(self.state, **(self.args | {"volume_exists": False})))

    def test_existing_database_without_state_is_refused(self):
        with self.assertRaisesRegex(ValueError, "no matching managed state"):
            core.managed_restart(self.state, **self.args)

    def test_matching_resources_resume(self):
        self.save()
        self.assertTrue(core.managed_restart(self.state, **self.args))

    def test_other_context_checkout_project_or_database_is_refused(self):
        for key in ("root", "context", "project", "volume"):
            with self.subTest(key=key):
                self.save(self.saved | {key: "unrelated"})
                with self.assertRaisesRegex(ValueError, "another checkout, context or project"):
                    core.managed_restart(self.state, **self.args)

    def test_deleted_database_cannot_be_silently_recreated(self):
        self.save()
        with self.assertRaisesRegex(ValueError, "database volume is missing"):
            core.managed_restart(self.state, **(self.args | {"volume_exists": False}))

    def test_deleted_dependencies_cannot_boot_an_empty_vendor_mount(self):
        self.save()
        with self.assertRaisesRegex(ValueError, "PHP dependency volume is missing"):
            core.managed_restart(self.state, **(self.args | {"dependency_volume_exists": False}))

    def test_invalid_state_does_not_become_a_new_project(self):
        for value in ("not json", "[]"):
            with self.subTest(value=value):
                self.state.write_text(value)
                with self.assertRaises(ValueError):
                    core.managed_restart(self.state, **self.args)


class RouterRestartTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {"graph_identity": "reviewed-graph", "graph_path": "/graphs/reviewed"}
        self.container = {
            "Config": {"Image": router.IMAGE, "Labels": {"com.mobility.owner": router.OWNER,
                       "com.mobility.graph_identity": "reviewed-graph"}},
            "State": {"Running": False}, "HostConfig": {"ReadonlyRootfs": True, "PortBindings": {}},
            "Mounts": [{"Source": "/graphs/reviewed", "Destination": "/data", "RW": False}],
            "NetworkSettings": {"Networks": {router.network_name(): {}}},
        }
        mock_docker = patch.object(router, "docker", return_value=subprocess.CompletedProcess(
            [], 0, json.dumps([{"Internal": True, "Labels": {"com.mobility.owner": router.OWNER}}])))
        self.docker = mock_docker.start(); self.addCleanup(mock_docker.stop)
        mock_inspect = patch.object(router, "inspect_container", return_value=self.container)
        self.inspect = mock_inspect.start(); self.addCleanup(mock_inspect.stop)
        mock_manifest = patch.object(router, "verify_manifest", return_value=self.manifest)
        mock_manifest.start(); self.addCleanup(mock_manifest.stop)
        mock_probe = patch.object(router, "probe", return_value={})
        self.probe = mock_probe.start(); self.addCleanup(mock_probe.stop)

    def up(self):
        return router.up(argparse.Namespace(mode="car"), {})

    def test_owned_stopped_router_resumes_without_recreation(self):
        self.assertEqual(self.up(), ["mobility-road-router-car"])
        self.assertTrue(any(call.args[:2] == ("start", "mobility-road-router-car") for call in self.docker.call_args_list))
        self.assertFalse(any(call.args[0] in {"create", "rm"} for call in self.docker.call_args_list))

    def test_running_router_is_reused_without_restart(self):
        self.container["State"]["Running"] = True
        self.up()
        self.assertFalse(any(call.args[0] in {"create", "start", "rm"} for call in self.docker.call_args_list))

    def test_unrelated_or_modified_router_is_never_started(self):
        cases = []
        for field, value in (("com.mobility.owner", "unrelated"), ("com.mobility.graph_identity", "other-graph")):
            c = copy.deepcopy(self.container); c["Config"]["Labels"][field] = value; cases.append(c)
        c = copy.deepcopy(self.container); c["Config"]["Image"] = "other-image"; cases.append(c)
        c = copy.deepcopy(self.container); c["Mounts"][0]["Source"] = "/other-graph"; cases.append(c)
        c = copy.deepcopy(self.container); c["HostConfig"]["PortBindings"] = {"5000/tcp": []}; cases.append(c)
        for c in cases:
            with self.subTest(container=c):
                self.inspect.return_value = c; self.docker.reset_mock()
                with self.assertRaises(router.RouterError):
                    self.up()
                self.assertFalse(any(call.args[0] in {"create", "start", "rm"} for call in self.docker.call_args_list))

    def test_failed_readiness_never_deletes_existing_router(self):
        self.probe.side_effect = router.RouterError("not ready")
        with patch.object(router.time, "monotonic", side_effect=[0, 31]):
            with self.assertRaises(router.RouterError):
                self.up()
        self.assertFalse(any(call.args[0] == "rm" for call in self.docker.call_args_list))


if __name__ == "__main__":
    unittest.main()
