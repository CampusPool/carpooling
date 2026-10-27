#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
repo=$(CDPATH= cd -- "$root/.." && pwd)
jdk="$repo/.local/toolchain/jdk/Contents/Home"
out="$root/.local-test-classes"
[ -x "$jdk/bin/javac" ] || { echo "pinned JDK is required" >&2; exit 2; }
trap 'rm -rf "$out"' EXIT
mkdir -p "$out"
"$jdk/bin/javac" -d "$out" "$root/tests/ProtocolContractTest.java"
"$jdk/bin/java" -cp "$out" com.mobility.demo.tracking.ProtocolContractTest
