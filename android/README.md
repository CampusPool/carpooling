# Mobility tracking companion (bounded demo)

This native Android companion shares a canonical trip only after a visible in-app start and explicit driver consent. It starts a location foreground service, shows an ongoing notification with a stop action, protects the bearer token with Android Keystore AES-GCM, and keeps at most 100 private location payloads for ordered reconnect. HTTP 410 clears the queue and ends sharing. No token, coordinate, or private URL is logged.

The source follows Android's current foreground-service requirements: declare the location service type and `FOREGROUND_SERVICE_LOCATION`, request coarse/fine location at runtime, and start from a visible activity. See [foreground service changes](https://developer.android.com/develop/background-work/services/fgs/changes) and [background-start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start). Background location permission is deliberately not requested by this bounded demo; any product decision to support it needs a separate review of Android policy and user disclosure.

## Build and checks

The project uses Android Gradle Plugin 8.6.1, compile/target SDK 35, and platform APIs only. `scripts/bootstrap-toolchain.sh` verifies pinned official Temurin 17, Gradle 8.7, and Google command-line tool archives, but deliberately does not accept SDK licenses or install SDK packages. `scripts/build-debug.sh` builds with the resulting local toolchain only when Android SDK Platform 35 is already approved and installed. Run `scripts/static-check.sh` for toolchain-free manifest/source checks.

## In-app start contract

The bounded demo has no exported bearer-token handoff. The visible native activity signs in through `POST /api/login` with email/password, validates `GET /api/users/me`, then loads `GET /api/users/my-trips` and offers only the account's planned or in-progress trips. The password field is cleared immediately; the returned token is stored only in Android Keystore. Sign-out stops tracking and clears the token, queue, and local trip fields. Server URLs may not contain credentials, query, or fragment; release builds require HTTPS. LAN HTTP is accepted only in a debuggable build for loopback, emulator host, or private `192.168.*` addresses.

The service calls `/api/mobility/trips/{trip}/tracking/session` with `{consent:true}`, then `/locations` with `session_id`, positive sequence, coordinates, accuracy and UTC `recorded_at`, and `{session_id}` to `/stop` when the user stops. Every mutating call includes an ASCII `Idempotency-Key`. Session responses accept the documented `{data:{session_id}}` envelope; strict location payloads do not include the local queue idempotency field. The visible activity starts the service while foreground because Android 12+ restricts background foreground-service starts and Android 14+ checks location permission at service creation.

The debug APK was built locally at `app/build/outputs/apk/debug/app-debug.apk` with the pinned JDK/Gradle and SDK Platform 35. Device install, GPS, screen-lock, reconnect, and terminal-trip tests remain pending. This is a debug build only; it makes no physical-device or production-readiness claim.

An explicit stop clears the local queue and token and sends the server stop request best effort. Android process death can interrupt that request; the server's lifecycle/expiry rules remain the authority for suppressing stale sharing. The companion does not claim reliable immediate revocation after a forced process kill or loss of power.

Stop requests include the captured session id. This prevents a delayed stop from revoking a newer session when the same trip is restarted; the request uses one stable idempotency key for that stop attempt.

Persisted locations are scoped to server, canonical trip, and fresh tracking session. A changed context or fresh process session clears prior samples, so GPS points cannot cross trips or sessions. Android 13+ notification permission is required before the service starts; denial leaves sharing stopped.

The local API hides coordinates after 30 seconds without a fresh recorded location and expires an inactive sharing session after a default 120-second lease. Offline stop and process-kill revocation are best effort; a lease bounds stale-client reuse, while the native device behavior still requires acceptance testing.
