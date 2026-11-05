#!/usr/bin/env python3
"""Prepare, build, and run private, reproducible local OSRM road graphs.

The command is deliberately local-only: it never downloads map data, exposes a
host port, or changes the pilot database.  All Docker invocations are argv
lists, and every long-running container is labelled as owned by this helper.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import math
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Iterable


IMAGE = "ghcr.io/project-osrm/osrm-backend@sha256:b0045097b8b4ad5e72dce6b900326cd6ee0e98c729709214e674d0472b463f49"
SOURCE_NAME = "southern-zone-261018.osm.pbf"
SOURCE_BYTES = 558_363_781
SOURCE_SHA256 = "8895361363703f104ccd3755349a23b99c860216f4ba2740706b560c46a48dbc"
BBOX = (77.20, 12.60, 78.00, 13.40)
CAR_PROFILE_SHA256 = "57778a757711e2ebef95d304e03e6ddf1a5693110d13a151914642344d59fa66"
FOOT_UPSTREAM_PROFILE_SHA256 = "74e231f81301d89a10e2bd0e67b787147c761b3ee06f665426e21a9b736372f4"
FOOT_PROFILE_SHA256 = "9aef5b1e7250d753fe57901d7d103fbaab6dc815f7288375b6c9bf95b37b6d8c"
OWNER = "mobility-road-router-v1"
MODES = ("car", "bike")
KNOWN_MODES = (*MODES, "foot")


class RouterError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(argv: list[str], *, timeout: int, check: bool = True, capture: bool = True) -> subprocess.CompletedProcess[str]:
    """Run an argv command with a bounded timeout (never through a shell)."""
    try:
        result = subprocess.run(
            argv, check=False, text=True, capture_output=capture, timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise RouterError(f"required command is unavailable: {argv[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise RouterError(f"command timed out after {timeout}s: {' '.join(argv)}") from exc
    if check and result.returncode:
        detail = (result.stderr or result.stdout or "").strip()[-4000:]
        raise RouterError(f"command failed ({result.returncode}): {' '.join(argv)}\n{detail}")
    return result


def root_from_script() -> Path:
    # scripts/<this file>, repository root is two parents above.
    return Path(__file__).resolve().parents[1]


def paths(root: Path) -> dict[str, Path]:
    base = root / ".local" / "routing"
    return {
        "root": root,
        "base": base,
        "source": base / "source" / SOURCE_NAME,
        "datasets": base / "datasets",
        "graphs": base / "graphs",
        "profiles": base / "profiles",
        "manifests": base / "manifests",
        "logs": base / "logs",
    }


def ensure_dirs(ps: dict[str, Path]) -> None:
    for key in ("base", "datasets", "graphs", "profiles", "manifests", "logs"):
        ps[key].mkdir(parents=True, exist_ok=True)


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    os.replace(tmp, path)


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise RouterError(f"invalid manifest: {path}") from exc
    if not isinstance(value, dict):
        raise RouterError(f"manifest is not an object: {path}")
    return value


def verify_source(ps: dict[str, Path], source: Path | None = None) -> dict[str, Any]:
    path = (source or ps["source"]).resolve()
    if not path.is_file():
        raise RouterError(f"source PBF missing; download the pinned provider file manually: {path}")
    size = path.stat().st_size
    digest = sha256(path)
    if size != SOURCE_BYTES or digest != SOURCE_SHA256:
        raise RouterError(f"source identity mismatch: bytes={size} sha256={digest}; expected {SOURCE_BYTES}/{SOURCE_SHA256}")
    return {"path": str(path), "bytes": size, "sha256": digest, "provider": "Geofabrik southern-zone-261018"}


def docker_context() -> str:
    selected = os.environ.get("MOBILITY_DOCKER_CONTEXT")
    return selected or run(["docker", "context", "show"], timeout=10).stdout.strip()


def docker(*args: str, timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["docker", "--context", docker_context(), *args], timeout=timeout, check=check)


def docker_argv(*args: str) -> list[str]:
    return ["docker", "--context", docker_context(), *args]


def image_present(image: str = IMAGE) -> bool:
    return docker("image", "inspect", image, timeout=30, check=False).returncode == 0


def profile_from_image(ps: dict[str, Path]) -> Path:
    target = ps["profiles"] / "car.lua"
    if target.exists():
        if sha256(target) != CAR_PROFILE_SHA256:
            raise RouterError(f"existing car profile hash mismatch: {target}")
        return target
    if not image_present():
        raise RouterError("pinned OSRM image is unavailable; pull it manually before prepare")
    result = docker("run", "--platform", "linux/arm64", "--rm", "--network=none", "--entrypoint", "cat", IMAGE, "/opt/car.lua", timeout=60)
    # The pinned Lua source is UTF-8; verify exact emitted bytes before use.
    data = (result.stdout or "").encode("utf-8")
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes(data)
    if sha256(tmp) != CAR_PROFILE_SHA256:
        tmp.unlink(missing_ok=True)
        raise RouterError("pinned image /opt/car.lua does not match engine-lock.json")
    os.replace(tmp, target)
    return target


def upstream_foot_profile_from_image(ps: dict[str, Path]) -> Path:
    """Cache and verify the exact /opt/foot.lua used by the wrapper."""
    target = ps["profiles"] / "upstream-foot.lua"
    if target.exists():
        if sha256(target) != FOOT_UPSTREAM_PROFILE_SHA256:
            raise RouterError(f"existing upstream foot profile hash mismatch: {target}")
        return target
    if not image_present():
        raise RouterError("pinned OSRM image is unavailable; pull it manually before prepare")
    result = docker("run", "--platform", "linux/arm64", "--rm", "--network=none", "--entrypoint", "cat", IMAGE, "/opt/foot.lua", timeout=60)
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes((result.stdout or "").encode("utf-8"))
    if sha256(tmp) != FOOT_UPSTREAM_PROFILE_SHA256:
        tmp.unlink(missing_ok=True)
        raise RouterError("pinned image /opt/foot.lua does not match engine-lock.json")
    os.replace(tmp, target)
    return target


def copy_profile(source: Path, target: Path, expected: str | None = None) -> Path:
    source = source.resolve()
    if not source.is_file():
        raise RouterError(f"profile missing: {source}")
    digest = sha256(source)
    if expected and digest != expected:
        raise RouterError(f"profile hash mismatch: {digest} != {expected}")
    if target.exists():
        if sha256(target) != digest:
            raise RouterError(f"refusing to overwrite different profile: {target}")
    else:
        shutil.copyfile(source, target)
    return target


def graph_hash(graph: Path) -> str:
    if any(p.is_symlink() for p in graph.rglob("*")):
        raise RouterError("graph contains a symlink; expected regular build artifacts")
    entries = []
    for item in sorted(p for p in graph.rglob("*") if p.is_file()):
        entries.append(str(item.relative_to(graph)) + ":" + sha256(item))
    return hashlib.sha256("\n".join(entries).encode()).hexdigest()


def prepare(args: argparse.Namespace, ps: dict[str, Path]) -> dict[str, Any]:
    ensure_dirs(ps)
    supplied_crop = Path(args.dataset).resolve() if args.dataset else None
    source_lock = read_json(ps["root"] / "research/experiments/real-routing/source-lock.json")
    if supplied_crop and not args.source and not ps["source"].is_file():
        # Exact reviewed crop bytes are sufficient build input. Do not pretend
        # the original regional PBF was freshly downloaded or re-verified.
        source_info = dict(source_lock["source"])
        source_info["verification"] = "historical source lock; exact crop freshly verified"
    else:
        source_info = verify_source(ps, Path(args.source) if args.source else None)
        source_info["verification"] = "original source freshly verified"
    car = profile_from_image(ps)
    upstream_foot = upstream_foot_profile_from_image(ps)
    foot = copy_profile(ps["root"] / "research/experiments/real-routing/profiles/pedestrian.lua", ps["profiles"] / "pedestrian.lua", FOOT_PROFILE_SHA256)
    bike: Path | None = None
    if args.bike_profile:
        bike = copy_profile(Path(args.bike_profile), ps["profiles"] / "motorbike.lua", args.bike_profile_sha256)
    previous_prepared = ps["manifests"] / "prepared.json"
    previous_motorbike = None
    if not bike and previous_prepared.exists():
        previous_motorbike = read_json(previous_prepared).get("motorbike_profile")
    bbox_name = "bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf"
    dataset = Path(args.dataset).resolve() if args.dataset else ps["datasets"] / bbox_name
    if args.dataset and not dataset.is_file():
        raise RouterError("--dataset must name an existing reviewed crop; new crops belong in managed storage")
    if dataset.exists():
        if args.force:
            raise RouterError(f"refusing implicit overwrite of existing dataset: {dataset}")
        if dataset.stat().st_size == 0:
            raise RouterError(f"existing dataset is empty: {dataset}")
    else:
        tmp = dataset.with_name(f".{dataset.name}.{os.getpid()}.partial")
        tmp.unlink(missing_ok=True)
        run(["osmium", "extract", "--bbox", ",".join(str(v) for v in BBOX), "--strategy", "complete_ways", "--output-format", "pbf", "--output", str(tmp), str(source_info["path"])], timeout=1800)
        os.replace(tmp, dataset)
    dataset_info = {"path": str(dataset.resolve()), "bytes": dataset.stat().st_size, "sha256": sha256(dataset)}
    source_lock = read_json(ps["root"] / "research/experiments/real-routing/source-lock.json")
    if dataset_info["sha256"] != source_lock["crop"]["sha256"] or dataset_info["bytes"] != source_lock["crop"]["bytes"]:
        raise RouterError("crop differs from the reviewed source lock; do not adopt arbitrary PBF inputs")
    if shutil.which("osmium"):
        run(["osmium", "check-refs", str(dataset)], timeout=120)
        source_info["crop_reference_check"] = "fresh osmium check-refs"
    else:
        # The accepted hash identifies the already reviewed complete crop.
        source_info["crop_reference_check"] = "locked crop hash; inherited zero missing nodes"
    source_info["replication_timestamp"] = source_lock["source"]["replication_timestamp"]
    source_info["license"] = source_lock["license"]
    source_info["provider_md5"] = source_lock["source"]["provider_md5"]
    source_info["osmium_version"] = run(["osmium", "--version"], timeout=10).stdout.splitlines()[0] if shutil.which("osmium") else source_lock["crop"]["tool"]
    result = {"schema_version": 1, "source": source_info, "bbox": list(BBOX), "strategy": "complete_ways", "dataset": dataset_info, "car_profile": {"path": str(car), "sha256": sha256(car), "version": "osrm-car-v26.10.0"}, "pedestrian_profile": {"path": str(foot), "sha256": sha256(foot), "version": "pedestrian-distance-v1", "upstream_path": str(upstream_foot), "upstream_sha256": sha256(upstream_foot)}}
    if bike:
        result["motorbike_profile"] = {"path": str(bike), "sha256": sha256(bike), "version": args.bike_profile_version or "unversioned-explicit-input"}
    elif previous_motorbike:
        result["motorbike_profile"] = previous_motorbike
    probe_tag = os.environ.get("MOBILITY_ROUTER_APP_IMAGE", "mobility-carpoolear-smoke-app")
    result["probe_image_id"] = docker("image", "inspect", "--format", "{{.Id}}", probe_tag, timeout=30).stdout.strip()
    atomic_json(ps["manifests"] / "prepared.json", result)
    return result


def mode_profile(ps: dict[str, Path], mode: str) -> tuple[Path, str, str]:
    if mode == "car":
        p = ps["profiles"] / "car.lua"
        version = "osrm-car-v26.10.0"
    elif mode == "bike":
        p = ps["profiles"] / "motorbike.lua"
        version = "motorbike-explicit-input"
    elif mode == "foot":
        p = ps["profiles"] / "pedestrian.lua"
        version = "pedestrian-distance-v1"
    else:
        raise RouterError(f"unsupported routing mode: {mode}")
    if not p.is_file():
        raise RouterError(f"{mode} profile is missing; run prepare with the explicit profile")
    return p, sha256(p), version


def build_one(mode: str, args: argparse.Namespace, ps: dict[str, Path], prepared: dict[str, Any]) -> dict[str, Any]:
    profile, profile_hash, profile_version = mode_profile(ps, mode)
    dataset = Path(prepared["dataset"]["path"])
    identity = hashlib.sha256(f"{prepared['dataset']['sha256']}:{mode}:{profile_hash}".encode()).hexdigest()
    final = ps["graphs"] / f"{mode}-{identity[:24]}"
    manifest_path = ps["manifests"] / f"{mode}.json"
    if manifest_path.exists():
        current = verify_manifest(mode, ps)
        if current["graph_identity"] == identity:
            return current
        raise RouterError("active manifest belongs to another graph; reconcile explicitly before promotion")
    if final.exists():
        raise RouterError(f"unmanifested graph retained at {final}; inspect its build log and reconcile manually before retrying")
    work = ps["graphs"] / f".{mode}-{identity[:16]}-{os.getpid()}"
    work.mkdir(parents=True)
    log = ps["logs"] / f"build-{mode}-{identity[:16]}.log"
    data_version = f"{mode}|crop_sha256={prepared['dataset']['sha256']}|profile_sha256={profile_hash}"
    prepared_key = {"car": "car_profile", "bike": "motorbike_profile", "foot": "pedestrian_profile"}[mode]
    if profile_hash != prepared[prepared_key]["sha256"]:
        raise RouterError("prepared profile changed; prepare the reviewed input again")
    if mode == "car" and profile_hash != CAR_PROFILE_SHA256:
        raise RouterError("car profile differs from pinned engine")
    stages = [
        ["osrm-extract", "--threads", "2", "--data_version", data_version, "-p", "/profile.lua", "-o", "/graphs/data.osrm", f"/input/{dataset.name}"],
        ["osrm-partition", "--threads", "2", "/graphs/data.osrm"],
        ["osrm-customize", "--threads", "2", "/graphs/data.osrm"],
    ]
    success = False
    try:
        with log.open("w") as fh:
            for stage in stages:
                name = f"mobility-road-build-{mode}-{uuid.uuid4().hex[:10]}"
                command = docker_argv("run", "--platform", "linux/arm64", "--name", name, "--label", f"com.mobility.owner={OWNER}", "--rm", "--network=none", "--cpus=2", "--memory=3g", "--memory-swap=3g", "--read-only", "--cap-drop=ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,nosuid,size=64m", "-w", "/opt", "-v", f"{profile}:/profile.lua:ro", "-v", f"{dataset.parent}:/input:ro", "-v", f"{work}:/graphs:rw", IMAGE, *stage)
                fh.write("$ " + " ".join(command) + "\n"); fh.flush()
                try:
                    completed = subprocess.run(command, stdout=fh, stderr=subprocess.STDOUT, timeout=1800, check=False)
                    fh.write(f"exit={completed.returncode}\n"); fh.flush()
                    if completed.returncode:
                        raise RouterError(f"{mode} {stage[0]} failed; retained partial output at {work}; see {log}")
                finally:
                    docker("rm", "-f", name, timeout=20, check=False)
        os.replace(work, final)
        manifest = {"schema_version": 1, "ready": True, "mode": mode, "image": IMAGE, "dataset_sha256": prepared["dataset"]["sha256"], "profile_sha256": profile_hash, "profile_version": profile_version, "graph_identity": identity, "data_version": data_version, "graph_path": str(final), "graph_sha256": graph_hash(final), "stages": {"extract": "success", "partition": "success", "customize": "success"}, "build_log": str(log)}
        atomic_json(manifest_path, manifest)
        success = True
        return manifest
    finally:
        if not success and work.exists():
            failed = work.with_name(work.name + ".failed")
            if not failed.exists():
                os.replace(work, failed)


def build(args: argparse.Namespace, ps: dict[str, Path]) -> list[dict[str, Any]]:
    prepared = read_json(ps["manifests"] / "prepared.json")
    if not Path(prepared["dataset"]["path"]).is_file() or sha256(Path(prepared["dataset"]["path"])) != prepared["dataset"]["sha256"]:
        raise RouterError("prepared dataset is missing or changed")
    modes = MODES if args.mode == "all" else (args.mode,)
    return [build_one(mode, args, ps, prepared) for mode in modes]


def owned_name(mode: str) -> str:
    return f"mobility-road-router-{mode}"


def network_name() -> str:
    return "mobility-road-router-internal"


def inspect_container(name: str) -> dict[str, Any] | None:
    result = docker("container", "inspect", name, timeout=30, check=False)
    if result.returncode:
        return None
    try:
        return json.loads(result.stdout)[0]
    except (ValueError, IndexError, TypeError):
        raise RouterError(f"unexpected Docker inspect output for {name}")


def verify_manifest(mode: str, ps: dict[str, Path]) -> dict[str, Any]:
    m = read_json(ps["manifests"] / f"{mode}.json")
    if m.get("ready") is not True or m.get("image") != IMAGE or m.get("mode") != mode:
        raise RouterError(f"{mode} graph manifest is not ready or does not match pinned image")
    graph = Path(m["graph_path"]).resolve()
    profile, profile_hash, _ = mode_profile(ps, mode)
    prepared = read_json(ps["manifests"] / "prepared.json")
    graphs_root = ps["graphs"].resolve()
    try:
        graph.relative_to(graphs_root)
    except ValueError as exc:
        raise RouterError(f"{mode} graph path escapes managed graph directory") from exc
    dataset_path = Path(prepared["dataset"]["path"])
    if not dataset_path.is_file() or sha256(dataset_path) != prepared["dataset"]["sha256"]:
        raise RouterError("prepared dataset is missing or changed")
    if mode == "car" and profile_hash != CAR_PROFILE_SHA256:
        raise RouterError("car profile differs from pinned engine")
    prepared_key = {"car": "car_profile", "bike": "motorbike_profile", "foot": "pedestrian_profile"}[mode]
    if profile_hash != prepared[prepared_key]["sha256"]:
        raise RouterError("profile differs from prepared manifest")
    expected_version = f"{mode}|crop_sha256={prepared['dataset']['sha256']}|profile_sha256={profile_hash}"
    if m.get("data_version") != expected_version or m.get("stages") != {"extract": "success", "partition": "success", "customize": "success"}:
        raise RouterError("graph version or build stages do not match")
    expected_identity = hashlib.sha256(f"{prepared['dataset']['sha256']}:{mode}:{profile_hash}".encode()).hexdigest()
    if m.get("graph_identity") != expected_identity or m.get("profile_sha256") != profile_hash or m.get("dataset_sha256") != prepared["dataset"]["sha256"] or not graph.is_dir() or m.get("graph_sha256") != graph_hash(graph):
        raise RouterError(f"{mode} graph provenance does not match current prepared inputs")
    return m


def raw_probe(url: str, network: str, ps: dict[str, Path]) -> dict[str, Any]:
    app_image = read_json(ps["manifests"] / "prepared.json")["probe_image_id"]
    if not image_present(app_image):
        raise RouterError(f"cached API probe image is unavailable: {app_image}")
    php = "$c=stream_context_create(['http'=>['timeout'=>5,'ignore_errors'=>true,'follow_location'=>0]]);$x=@file_get_contents($argv[1],false,$c,0,65537);if($x===false){echo json_encode(['probe_error'=>'unavailable']);exit(0);}if(strlen($x)>65536){exit(3);}echo $x;"
    result = docker("run", "--platform", "linux/arm64", "--rm", "--network", network, "--cpus=0.5", "--memory=128m", "--memory-swap=128m", "--read-only", "--cap-drop=ALL", "--security-opt", "no-new-privileges:true", "--entrypoint", "php", app_image, "-r", php, url, timeout=15)
    try:
        body = json.loads(result.stdout)
    except ValueError as exc:
        raise RouterError("router returned invalid JSON") from exc
    if not isinstance(body, dict):
        raise RouterError("router response must be an object")
    return body


def probe(mode: str, network: str, ps: dict[str, Path]) -> dict[str, Any]:
    m = verify_manifest(mode, ps)
    coordinates = ((77.5946, 12.9716), (77.6200, 12.9352))
    radius = 50 if mode == "foot" else 250
    # OSRM's HTTP service segment is conventionally named `driving` even when
    # the loaded extraction profile is walking; the graph/profile identity is
    # carried by data_version and manifest validation.
    body = raw_probe(f"http://{owned_name(mode)}:5000/route/v1/driving/77.5946,12.9716;77.6200,12.9352?overview=false&steps=false&alternatives=false&radiuses={radius};{radius}", network, ps)
    route = (body.get("routes") or [{}])[0]
    if body.get("code") != "Ok" or body.get("data_version") != m["data_version"]:
        raise RouterError(f"{mode} route readiness/graph version failed")
    for field, limit in (("distance", 100000), ("duration", 86400)):
        value = route.get(field)
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= limit:
            raise RouterError(f"{mode} invalid route {field}")
    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list) or len(waypoints) != 2:
        raise RouterError("expected two snapped waypoints")
    for point, requested in zip(waypoints, coordinates):
        snap, location = point.get("distance"), point.get("location")
        if type(snap) not in (int, float) or not math.isfinite(snap) or not 0 <= snap <= radius or not isinstance(location, list) or len(location) != 2 or any(type(v) not in (int, float) or not math.isfinite(v) for v in location):
            raise RouterError("invalid waypoint snap")
        lon1, lat1, lon2, lat2 = map(math.radians, (*requested, *location))
        h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
        if 6371000*2*math.asin(math.sqrt(min(1, max(0, h)))) > radius:
            raise RouterError("waypoint location exceeds snap distance")
    return {"mode": mode, "data_version": body["data_version"], "distance_meters": route["distance"], "duration_seconds": route["duration"], "snaps_meters": [p["distance"] for p in waypoints]}


def validate_router_container(container: dict[str, Any] | None, manifest: dict[str, Any]) -> None:
    labels = (container or {}).get("Config", {}).get("Labels", {})
    if not container or labels.get("com.mobility.owner") != OWNER or labels.get("com.mobility.graph_identity") != manifest["graph_identity"] or container.get("Config", {}).get("Image") != IMAGE:
        raise RouterError("router identity does not match the verified graph and image")
    if container.get("HostConfig", {}).get("ReadonlyRootfs") is not True or container.get("HostConfig", {}).get("PortBindings"):
        raise RouterError("router runtime is not read-only/private")
    if not any(m.get("Destination") == "/data" and m.get("Source") == manifest["graph_path"] and m.get("RW") is False for m in container.get("Mounts", [])):
        raise RouterError("router graph mount does not match the verified read-only graph")
    if network_name() not in container.get("NetworkSettings", {}).get("Networks", {}):
        raise RouterError("router is not attached to its managed network")


def verify_runtime(mode: str, ps: dict[str, Path]) -> dict[str, Any]:
    manifest = verify_manifest(mode, ps)
    container = inspect_container(owned_name(mode))
    validate_router_container(container, manifest)
    if container.get("State", {}).get("Running") is not True:
        raise RouterError("router is stopped; run up to resume its verified container")
    network = json.loads(docker("network", "inspect", network_name(), timeout=30).stdout)[0]
    if network.get("Internal") is not True or network.get("Labels", {}).get("com.mobility.owner") != OWNER:
        raise RouterError("router network is not the owned internal network")
    result = probe(mode, network_name(), ps)
    outside = raw_probe(f"http://{owned_name(mode)}:5000/route/v1/driving/0,0;0.001,0?overview=false&radiuses=250;250", network_name(), ps)
    if outside.get("code") != "NoSegment" or outside.get("routes"):
        raise RouterError("outside-graph query did not fail closed")
    unavailable = raw_probe("http://127.0.0.1:9/route/v1/driving/0,0;0.001,0", network_name(), ps)
    if unavailable != {"probe_error": "unavailable"}:
        raise RouterError("unreachable service did not fail closed")
    result["outside_graph_code"] = outside["code"]
    result["unreachable_service"] = "unavailable"
    return result


def up(args: argparse.Namespace, ps: dict[str, Path]) -> list[str]:
    modes = MODES if args.mode == "all" else (args.mode,)
    manifests = [verify_manifest(mode, ps) for mode in modes]
    network = network_name()
    existing_network = docker("network", "inspect", network, timeout=30, check=False).returncode == 0
    if existing_network:
        # Only reuse a network labelled as ours.
        info = json.loads(docker("network", "inspect", network, timeout=30).stdout)[0]
        if info.get("Labels", {}).get("com.mobility.owner") != OWNER or info.get("Internal") is not True:
            raise RouterError(f"refusing unknown network: {network}")
    else:
        docker("network", "create", "--internal", "--label", f"com.mobility.owner={OWNER}", network, timeout=30)
    created: list[str] = []
    started: list[str] = []
    try:
        for mode, manifest in zip(modes, manifests):
            name = owned_name(mode)
            existing = inspect_container(name)
            if existing:
                validate_router_container(existing, manifest)
            else:
                docker("create", "--platform", "linux/arm64", "--name", name, "--network", network, "--network-alias", name, "--label", f"com.mobility.owner={OWNER}", "--label", f"com.mobility.graph_identity={manifest['graph_identity']}", "--cpus=1", "--memory=384m", "--memory-swap=384m", "--read-only", "--cap-drop=ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "-v", f"{manifest['graph_path']}:/data:ro", "--entrypoint", "osrm-routed", IMAGE, "--algorithm", "MLD", "--threads", "1", "--max-viaroute-size", "8", "--max-table-size", "8", "--max-matching-size", "8", "--max-trip-size", "8", "--max-alternatives", "1", "--max-nearest-size", "8", "--mmap=1", "/data/data.osrm", timeout=60)
                created.append(name)
            started.append(name)
            if not existing or existing.get("State", {}).get("Running") is not True:
                docker("start", name, timeout=60)
            # The app image executes the API probe inside the internal network.
            deadline = time.monotonic() + 30
            while True:
                try:
                    probe(mode, network, ps)
                    break
                except RouterError:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(1)
        return started
    except Exception:
        for name in created:
            docker("rm", "-f", name, timeout=30, check=False)
        if not existing_network:
            docker("network", "rm", network, timeout=30, check=False)
        raise


def down(args: argparse.Namespace, ps: dict[str, Path]) -> None:
    modes = MODES if args.mode == "all" else (args.mode,)
    for mode in modes:
        name = owned_name(mode)
        info = inspect_container(name)
        if info and info.get("Config", {}).get("Labels", {}).get("com.mobility.owner") != OWNER:
            raise RouterError(f"refusing unknown container: {name}")
        if info:
            docker("rm", "-f", name, timeout=30)
    if not any(inspect_container(owned_name(mode)) for mode in KNOWN_MODES):
        info = docker("network", "inspect", network_name(), timeout=30, check=False)
        if info.returncode == 0:
            parsed = json.loads(info.stdout)[0]
            if parsed.get("Labels", {}).get("com.mobility.owner") == OWNER:
                docker("network", "rm", network_name(), timeout=30)


def status(args: argparse.Namespace, ps: dict[str, Path]) -> dict[str, Any]:
    result: dict[str, Any] = {"network": network_name(), "modes": {}}
    for mode in KNOWN_MODES:
        path = ps["manifests"] / f"{mode}.json"
        m = read_json(path) if path.exists() else None
        c = inspect_container(owned_name(mode))
        result["modes"][mode] = {"manifest_ready": bool(m and m.get("ready") is True), "graph_identity": m.get("graph_identity") if m else None, "container": (c or {}).get("State", {}).get("Status") if c else None}
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, help="repository root (defaults to the checkout containing this script)")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare", help="verify source and crop the immutable complete-ways dataset")
    p.add_argument("--source", type=Path)
    p.add_argument("--dataset", type=Path, help="use an already cropped complete-ways PBF after verifying it")
    p.add_argument("--bike-profile", type=Path)
    p.add_argument("--bike-profile-sha256")
    p.add_argument("--bike-profile-version")
    p.add_argument("--force", action="store_true", help="reserved; existing artifacts are still never overwritten")
    for name in ("build", "up", "down", "verify", "status"):
        q = sub.add_parser(name)
        q.add_argument("--mode", choices=("car", "bike", "foot", "all"), default="all")
    args = parser.parse_args(list(argv) if argv is not None else None)
    root = (args.root or root_from_script()).resolve()
    ps = paths(root)
    try:
        lock = read_json(root / "research/experiments/real-routing/engine-lock.json")
        if lock.get("image") != IMAGE or lock.get("platform") != "linux/arm64" or lock.get("binary_version") != "v26.10.0" or lock.get("bundled_car_profile_sha256") != CAR_PROFILE_SHA256 or lock.get("bundled_foot_profile_sha256") != FOOT_UPSTREAM_PROFILE_SHA256 or lock.get("pedestrian_wrapper_sha256") != FOOT_PROFILE_SHA256:
            raise RouterError("engine lock differs from this reviewed helper")
        endpoint = run(["docker", "context", "inspect", docker_context(), "--format", "{{.Endpoints.docker.Host}}"], timeout=10).stdout.strip()
        if not endpoint.startswith("unix://"):
            raise RouterError("selected Docker context must use a local Unix socket")
        if args.command not in ("status", "down"):
            arch = docker("image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", IMAGE, timeout=30).stdout.strip()
            if arch != lock["platform"]:
                raise RouterError("cached engine platform differs from lock")
        if args.command == "prepare":
            print(json.dumps(prepare(args, ps), indent=2, sort_keys=True))
        elif args.command == "build":
            ensure_dirs(ps)
            print(json.dumps(build(args, ps), indent=2, sort_keys=True))
        elif args.command == "up":
            ensure_dirs(ps)
            print(json.dumps({"started": up(args, ps)}, indent=2))
        elif args.command == "down":
            down(args, ps)
            print(json.dumps({"stopped": True}))
        elif args.command == "status":
            status(args, ps)
        elif args.command == "verify":
            modes = MODES if args.mode == "all" else (args.mode,)
            checks = [verify_runtime(mode, ps) for mode in modes]
            print(json.dumps({"verified": checks}, indent=2))
        return 0
    except (RouterError, subprocess.TimeoutExpired, KeyboardInterrupt) as exc:
        print(f"mobility-road-router: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
