#!/bin/sh
# Run from any directory; stdout contains only synthetic/sanitized evidence.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec sh "$root/docs/dbms/level3/verify.sh"
