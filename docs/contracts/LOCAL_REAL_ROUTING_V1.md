# LOCAL_REAL_ROUTING_V1

20 October 2026. Prepare actual road routing without promoting invented points, test fares or uncalibrated times into a passenger service. Both car and motorbike remain required; this local graph is an engineering increment, not release acceptance.

## Immutable inputs and resource boundary

Pin OSRM v26.10.0 ARM64 Debian image by manifest digest `sha256:b0045097b8b4ad5e72dce6b900326cd6ee0e98c729709214e674d0472b463f49`. Its annotated release tag object20b92320aa81588f06477ee87a7be59515c78f48 dereferences to source commit26a73bd16dd0fba18dc4adc92b5c022bcc40cabe, matching image labels; binary reports v26.10.0. Bundled /opt/car.lua SHA256 is57778a757711e2ebef95d304e03e6ddf1a5693110d13a151914642344d59fa66. Preserve OSRM BSD-2-Clause attribution and OSM ODbL attribution/source identity.

Use the dated Geofabrik southern-zone-261018.osm.pbf,558363781bytes, verify provider checksum and record SHA256 before processing. Crop with Osmium complete_ways to padded Bengaluru reference bbox77.20,12.60,78.00,13.40; this supports software validation around the existing catalog envelope, not a revised service boundary. Retain source timestamp, exact bbox/strategy, tool versions, output hashes, commands/exit codes. Keep source/PBF/graphs private/ignored local artifacts. No implicit destructive overwrite; failed build output is retained distinctly and never marked ready.

Build car and motorbike graphs sequentially with explicit profile/data_version, extraction/partition/customize threads2, at most2CPUs/3GiB, network disabled. Keep the existing synthetic pilot/DB intact. Runtime graph mounts are read-only; each router at most1CPU/384MiB, internal isolated network, no public port. Any diagnostic host gateway must be explicitly loopback-only. No provider/dependency installer during runtime. Startup requires verified matching input/profile/graph manifests and a successful bounded route health probe. Changes produce new graph identity; no healthy claim from container existence alone.

## Motorbike profile

Load the pinned /opt/car.lua implementation and wrap setup only where verified. Set access hierarchy motorcycle -> motor_vehicle -> vehicle -> access and restriction types motorcycle -> motor_vehicle -> vehicle. Preserve driving mode and the exact handler order, surfaces/smoothness, oneway handling, barriers, turn penalties, ferry behavior and supported road classes. Do not inherit bicycle shortcuts/opposite-cycleway rules or speeds. Verify directional and motorcycle-specific tags against actual library behavior; document unsupported tags rather than imply enforcement.

Retain conservative upstream car dimension thresholds and speed assumptions initially; they are software profile choices, not measurements of the user's vehicles or validated motorcycle ETA. This may exclude routes a smaller bike could use and requires later fleet calibration. Do not silently relax barriers/private roads or claim compliance with all local restrictions from OSM tags. Road access, pickup safety, current closures/weather and operating eligibility need separate verification.

The motorbike profile must be a distinct versioned file/hash and independently extracted dataset/endpoint. A URL profile label alone does not select a graph in OSRM and cannot prove mode correctness. Tiny synthetic OSM fixtures must demonstrate car/motorcycle access differences, motorcycle-specific deny/allow precedence, directional access, ordinary one-way behavior, bicycle-only exclusion, barrier handling, mode-specific turn restrictions and motorway exclusion. Never substitute car routing if a motorbike graph fails.

## Provider and journey proof

Actual-city probes use clearly labeled public-road reference coordinates, not private Hopr route data or approved passenger stops. Verify bounded positive metrics, waypoint snaps<=250m, declared graph/profile identity, no-segment/outside-graph and unreachable service. No stale/synthetic fallback on failure. OSRM data_version and graph manifest must identify the prepared map/profile; record actual API support before relying on it.

Before binding the application to a real router, make route provenance explicit and test mode/graph mismatch. Any test catalog or fare remains labeled test-only; physically verified operating points and approved integer fare policy are separate human gates. Then prove actual route quote -> canonical offer/booking/lifecycle for both modes, preserving current authority/locks and no network calls inside trust/ride transactions. Reuse existing protected cohort/host/capacity/fare guards.

Official sources: [OSRM v26.10.0](https://github.com/Project-OSRM/osrm-backend/releases/tag/v26.10.0), [OSRM build tools](https://project-osrm.org/docs/v26.4.0/tools), [Geofabrik region](https://download.geofabrik.de/asia/india/southern-zone.html), [Osmium extraction](https://docs.osmcode.org/osmium/latest/osmium-extract.html), [OSM attribution](https://www.openstreetmap.org/copyright). These establish tools/data provenance, not service suitability.
