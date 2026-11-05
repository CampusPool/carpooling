# Pinned local road-routing source

The helper, engine/source locks, motorcycle profile and pedestrian profile are
preserved from the existing local MobilityPlatform implementation. OSRM is
Project-OSRM's BSD-2-Clause engine; map data is OpenStreetMap data under ODbL-1.0,
provided by Geofabrik. Attribute OpenStreetMap contributors:
https://www.openstreetmap.org/copyright . No Google credential is included here.

The engine lock pins OSRM v26.10.0 **linux/arm64** by immutable image digest.
An ARM64 Docker host or functioning ARM64 emulation is required. The wrapper
tests the binary before building graphs. Car, motorbike and pedestrian graphs
are separate and carry distinct mode/profile data-version hashes.

The original dated regional download currently returns HTTP 404. Teammate
handoffs therefore include the exact reviewed 49,098,156-byte complete-ways
crop as a **non-Git development asset**, SHA-256
`60d07b08ab0643b8ef0243da9b6c866c0ccd1b00c3a7a94d03382adf1e90a9e0`.
The builder verifies that exact hash before using it. When only the locked
crop is supplied, metadata explicitly distinguishes inherited original-source
provenance from the freshly verified crop; it does not claim a fresh regional
download or a fresh Osmium crop operation.

`scripts/mobility-road-router.py` accepts any local Unix-socket Docker context
through `MOBILITY_DOCKER_CONTEXT` and otherwise uses `docker context show`.
It refuses remote Docker daemons, unknown existing router/network identities,
changed crop/profile hashes, and mismatched graph versions. It never deletes
application databases. It can perform an Osmium reference check when `osmium`
is installed; exact locked crop bytes do not require a fresh extraction.

See [RUN_LOCAL_CORE.md](../../../RUN_LOCAL_CORE.md) for one-command app startup.
