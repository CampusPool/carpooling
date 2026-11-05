#!/bin/sh
# Source after setting root; graph identities are local provenance, never keys.
mobility_load_road_env() {
  python3 "$root/scripts/mobility-road-router.py" verify >/dev/null
  python3 "$root/scripts/mobility-road-router.py" verify --mode foot >/dev/null
  MOBILITY_PROOF_CAR_PIN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data_version"])' "$root/.local/routing/manifests/car.json")
  MOBILITY_PROOF_BIKE_PIN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data_version"])' "$root/.local/routing/manifests/bike.json")
  MOBILITY_PROOF_FOOT_PIN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data_version"])' "$root/.local/routing/manifests/foot.json")
  export MOBILITY_PROOF_CAR_PIN MOBILITY_PROOF_BIKE_PIN MOBILITY_PROOF_FOOT_PIN
}
