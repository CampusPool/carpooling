# CampusPool Ola student preview

The integrated preview combines PES email sign-in, timetable review and manual editing, student address rides, the redesigned student interface, and the protected admin center. Ola provides address search, route planning and student route-map images. The student route-map preview is a static image; it does not expose the server API key. An interactive map still requires a separate, appropriately restricted browser key.

## Configuration

Set `NEXT_PUBLIC_MAP_PROVIDER=ola` and `NEXT_PUBLIC_STUDENT_ONLY=1` while building the frontend. At runtime, configure `OLA_MAPS_ENABLED=1` and `OLA_MAPS_API_KEY` for the frontend server, and `MOBILITY_ROUTING_PROVIDER=ola` and `OLA_MAPS_API_KEY` for Laravel. Set `MOBILITY_API_ORIGIN` to the private backend and `MOBILITY_PUBLIC_ORIGIN` to the exact public origin. Configure the existing email provider and database settings independently. Store all keys in private runtime configuration, not in Git or build arguments.

The student interface requests a same-origin authenticated static map with bounded Bengaluru coordinates. The server requests the Ola image and returns it without revealing its server key. Search, routes and static maps consume Ola API usage; per-process limits are not a distributed quota control.

## Provider transition

Keep a verified backup and a tested rollback before switching a real database. Existing OSRM quotes and route identities must not be silently treated as Ola quotes. Review active rides and their state before retirement; retain the old routers until the new deployment is verified. The hosted preview retains stopped OSRM containers as a rollback path. MySQL/Mongo, Laravel and the application frontend remain part of the hosting stack.

Ola meeting-point search tests ordered candidate pairs in increasing geometric lower bound and stops only when remaining pairs cannot beat an already validated walking route. Actual foot routes and the combined walking limit remain authoritative; a straight-line estimate cannot by itself make a ride eligible. Ola provider failures remain visible rather than being interpreted as successful matches.

## Verification and limits

On 14 November 2026, the integration passed 163 frontend tests, 444 backend tests (two skipped), and three student address-ride tests using real Ola routing. The shared-ride test passed two additional runs. Hosted checks verified Ola car, bike and walking routes with the previous OSRM containers stopped, authenticated student profile and saved timetable retrieval, address autocomplete, static-map response, and admin data feeds. The public preview gate and admin page responded.

This evidence is scoped: the historical intermittent 503 did not produce a captured error code; provider latency or outages can still cause failures. The latest deployment did not include a fresh end-to-end booking by real students, a fresh real Academy import, new live OTP delivery, physical-device tracking or actual payment. Preview runtime availability and provider quota remain operational dependencies.
