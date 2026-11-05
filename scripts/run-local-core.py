#!/usr/bin/env python3
"""Start the local core app from source and an exact offline road crop.

Never invokes down -v, never copies credentials into Git, and never silently
reuses another Docker project's database. Maps configuration is private input.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
EXP = ROOT / "research/experiments/carpoolear"
IMAGE = "ghcr.io/project-osrm/osrm-backend@sha256:b0045097b8b4ad5e72dce6b900326cd6ee0e98c729709214e674d0472b463f49"
CROP_NAME = "bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf"


def run(argv, *, cwd=ROOT, env=None, capture=False, check=True):
    return subprocess.run([str(x) for x in argv], cwd=cwd, env=env, check=check,
                          text=True, stdout=subprocess.PIPE if capture else None)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def managed_restart(state_file, *, root, project, context, volume, volume_exists,
                    dependency_volume_exists):
    if not state_file.exists():
        if volume_exists:
            raise ValueError("an existing database volume has no matching managed state; choose a new --project")
        return False
    state = json.loads(state_file.read_text())
    expected = {"root": str(root), "project": project, "context": context, "volume": volume}
    if not isinstance(state, dict) or any(state.get(key) != value for key, value in expected.items()):
        raise ValueError("managed state belongs to another checkout, context or project; use its original settings or a new --project")
    if not volume_exists:
        raise ValueError("managed database volume is missing; refusing to recreate an empty database as a restart; choose a new --project")
    if not dependency_volume_exists:
        raise ValueError("managed PHP dependency volume is missing; restore it or choose a new --project")
    return True


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--context", default=os.environ.get("MOBILITY_DOCKER_CONTEXT"))
    p.add_argument("--project", default="mobility-core-local")
    p.add_argument("--frontend-port", type=int, default=3012)
    p.add_argument("--dataset", type=Path)
    p.add_argument("--maps-config", type=Path, default=ROOT / ".local/maps-demo/google.json")
    p.add_argument("--check", action="store_true", help="validate supplied inputs without Docker or mutations")
    args = p.parse_args()
    if not re.fullmatch(r"mobility-core-[a-z0-9][a-z0-9-]{0,40}", args.project):
        p.error("project must start mobility-core- and contain lowercase letters, digits and hyphens")
    if not 1024 <= args.frontend_port <= 65535:
        p.error("frontend port must be between 1024 and 65535")
    candidates = [ROOT / "handoff-assets" / CROP_NAME, ROOT.parent / "assets" / CROP_NAME,
                  ROOT / ".local/routing/datasets" / CROP_NAME]
    dataset = (args.dataset or next((x for x in candidates if x.is_file()), candidates[0])).resolve()
    lock = json.loads((ROOT / "research/experiments/real-routing/source-lock.json").read_text())
    if not dataset.is_file() or dataset.stat().st_size != lock["crop"]["bytes"] or digest(dataset) != lock["crop"]["sha256"]:
        p.error("provide the supplied exact offline crop via --dataset; see RUN_LOCAL_CORE.md")
    key_file = args.maps_config.resolve()
    if not key_file.is_file() or key_file.stat().st_size > 4096:
        p.error("provide private Google browser configuration via --maps-config; see RUN_LOCAL_CORE.md")
    config = json.loads(key_file.read_text())
    if config.get("kind") != "google_maps_demo" or not re.fullmatch(r"AIza[0-9A-Za-z_-]{30,60}", config.get("browser_key", "")):
        p.error("maps configuration must contain kind google_maps_demo and a browser key")
    if key_file.stat().st_mode & 0o077:
        p.error("maps configuration must be private: chmod 600 PATH")
    if args.check:
        print("Offline crop hash and private browser configuration inputs are valid. No runtime was changed.")
        return 0
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", args.frontend_port))
        except OSError:
            p.error("frontend port is already in use; select another --frontend-port")
    context = args.context or run(["docker", "context", "show"], capture=True).stdout.strip()
    docker = ["docker", "--context", context]
    endpoint = run(docker[:1] + ["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"], capture=True).stdout.strip()
    if not endpoint.startswith("unix://"):
        p.error("only a local Unix-socket Docker context is supported")
    runtime = ROOT / ".local/core-runtime" / args.project
    state_file = runtime / "state.json"
    volume = "mobility-carpoolear-disposable-demo-" + args.project
    volume_exists = run(docker + ["volume", "inspect", volume], capture=True, check=False).returncode == 0
    dependency_volume_exists = run(docker + ["volume", "inspect", args.project + "_core-php-vendor"], capture=True, check=False).returncode == 0
    restarting = managed_restart(state_file, root=ROOT, project=args.project,
                                 context=context, volume=volume, volume_exists=volume_exists,
                                 dependency_volume_exists=dependency_volume_exists)
    env = os.environ.copy()
    env.update(MOBILITY_DOCKER_CONTEXT=context, MOBILITY_ROUTER_APP_IMAGE="mobility-core-router-probe",
               MOBILITY_DEMO_INSTANCE=args.project, MOBILITY_SMOKE_DB_VOLUME=args.project + "-db")
    run(["sh", "scripts/prepare-carpoolear.sh"], env=env)
    run(docker + ["build", "-t", env["MOBILITY_ROUTER_APP_IMAGE"], "-f", "Dockerfile.smoke", "."], cwd=EXP)
    run(docker + ["pull", "--platform", "linux/arm64", IMAGE])
    # An ARM64 Linux host or functioning ARM64 emulation is required by the
    # reviewed engine lock. Fail before graph work if that binary cannot run.
    run(docker + ["run", "--rm", "--platform", "linux/arm64", "--network=none", IMAGE, "osrm-routed", "--version"])
    router = [sys.executable, ROOT / "scripts/mobility-road-router.py"]
    run(router + ["prepare", "--dataset", dataset, "--bike-profile", ROOT / "research/experiments/real-routing/profiles/motorcycle.lua", "--bike-profile-version", "motorcycle-access-v1"], env=env)
    for mode in ("car", "bike", "foot"):
        run(router + ["build", "--mode", mode], env=env)
        manifest = json.loads((ROOT / ".local/routing/manifests" / (mode + ".json")).read_text())
        env["MOBILITY_PROOF_" + mode.upper() + "_PIN"] = manifest["data_version"]
        run(router + ["up", "--mode", mode], env=env)
        run(router + ["verify", "--mode", mode], env=env)
    runtime.mkdir(parents=True, exist_ok=True)
    env["MOBILITY_PATCH_DIGEST"] = digest(EXP / "patches/critical-invariants.patch")
    run(["sh", "-c", '. "$1/scripts/mobility-runtime.sh"; mobility_init_test_env "$2/.env"', "sh", ROOT, EXP], env=env)
    compose = docker + ["compose", "--project-name", args.project]
    for name in ("compose.smoke.yml", "compose.journey.yml", "compose.hardened.yml", "compose.lifecycle.yml", "compose.disposable-demo.yml", "compose.core-roads.yml"):
        compose += ["-f", str(EXP / name)]
    compose += ["--env-file", str(EXP / ".env")]
    run(compose + ["config", "--quiet"], cwd=EXP, env=env)
    if restarting:
        run(compose + ["up", "-d", "--no-deps", "mysql", "app", "gateway"], cwd=EXP, env=env)
    else:
        run(compose + ["up", "-d", "--build"], cwd=EXP, env=env)
        state_file.write_text(json.dumps({"root": str(ROOT), "project": args.project, "context": context, "volume": volume}, indent=2) + "\n")
    app = args.project + "-app-1"
    run(docker + ["cp", key_file, app + ":/tmp/mobility-google-maps-demo.json"])
    run(docker + ["exec", app, "chmod", "600", "/tmp/mobility-google-maps-demo.json"])
    mapping = run(compose + ["port", "gateway", "8080"], cwd=EXP, env=env, capture=True).stdout.strip()
    if not mapping.startswith("127.0.0.1:"):
        p.error("gateway was not bound to loopback")
    origin = "http://" + mapping
    for attempt in range(30):
        try:
            with urllib.request.urlopen(origin + "/api/health", timeout=3) as response:
                if response.status == 200:
                    break
        except (OSError, TimeoutError):
            time.sleep(1)
    else:
        p.error("backend health did not become ready; inspect managed project logs")
    frontend_env = env | {"MOBILITY_API_ORIGIN": origin, "NEXT_PUBLIC_CANONICAL_DEMO": "1"}
    run(["npm", "ci"], cwd=ROOT / "frontend-next")
    print(f"Local app: http://127.0.0.1:{args.frontend_port}/", flush=True)
    print("Create driver/rider accounts in separate tabs. Ctrl-C stops the UI; Docker database remains preserved.", flush=True)
    run(["npm", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", str(args.frontend_port)], cwd=ROOT / "frontend-next", env=frontend_env)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nUI stopped. Local Docker project and database preserved.")
    except (subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f"Local setup failed: {error}. Existing data was preserved.", file=sys.stderr)
        raise SystemExit(2)
