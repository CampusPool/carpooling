#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
repo=$(CDPATH= cd -- "$root/.." && pwd)
jdk="$repo/.local/toolchain/jdk/Contents/Home"
gradle="$repo/.local/toolchain/gradle/gradle-8.7/bin/gradle"
sdk="$repo/.local/toolchain/android-sdk"
[ -x "$jdk/bin/java" ] || { echo "missing pinned JDK; run bootstrap-toolchain.sh and extract it" >&2; exit 2; }
[ -x "$gradle" ] || { echo "missing pinned Gradle; run bootstrap-toolchain.sh and extract it" >&2; exit 2; }
[ -f "$sdk/platforms/android-35/android.jar" ] || { echo "Android SDK platform 35 is required; install it through an approved SDK workflow" >&2; exit 2; }
export JAVA_HOME="$jdk"
export ANDROID_SDK_ROOT="$sdk"
exec "$gradle" -p "$root" :app:assembleDebug --no-daemon "$@"
