#!/bin/sh
set -eu

# Downloads only pinned upstream tools. It never runs sdkmanager, accepts SDK
# licenses, touches adb, or installs a platform package.
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cache="$root/../.local/toolchain/cache"
mkdir -p "$cache"

fetch() {
  url=$1; file=$2; expected=$3
  [ -f "$cache/$file" ] || curl -fL --retry 2 -o "$cache/$file" "$url"
  actual=$(shasum -a 256 "$cache/$file" | awk '{print $1}')
  [ "$actual" = "$expected" ] || { echo "checksum mismatch: $file" >&2; exit 1; }
}

fetch 'https://api.adoptium.net/v3/binary/version/jdk-17.0.20.1%2B1/mac/aarch64/jdk/hotspot/normal/eclipse' \
  jdk17.tar.gz 196d13ba5f10414bef7f6a05a9b3f00edacb18ebacef2b99485db9e2ee18f0e8
fetch 'https://github.com/gradle/gradle-distributions/releases/download/v8.7.0/gradle-8.7-bin.zip' \
  gradle-8.7-bin.zip 544c35d6bd849ae8a5ed0bcea39ba677dc40f49df7d1835561582da2009b961d
fetch 'https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip' \
  commandlinetools-mac-11076708_latest.zip 7bc5c72ba0275c80a8f19684fb92793b83a6b5c94d4d179fc5988930282d7e64
echo "Pinned tool archives are verified in $cache"
