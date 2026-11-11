# PES Academy timetable integration

The signed-in student website can import a timetable from PES Academy, review a weekly grid and save it to the current CampusPool account. Manual add/edit/remove remains available. An import is a preview: it does not overwrite saved classes until **Save imported timetable** or **Replace saved timetable** is selected. Where Academy returns multiple choices in a slot, the student must select the class they attend. The importer does not infer elective enrollment or free periods, and does not automatically schedule or book rides.

The Next.js route `POST /api/pes-timetable` checks the existing CampusPool bearer session with Laravel before contacting Academy. The server visits the Academy login page, posts credentials to its same-origin login handler, then requests the timetable page and parses its embedded structured data. Request credentials and Academy cookies are transient; the app does not intentionally persist or log them. Only reviewed timetable entries are saved through the account-scoped Laravel timetable endpoints in MySQL. Browser password managers and external infrastructure have separate retention behavior.

This integration adapts the original pilot by arjunsrikanthh in PR #96, commit `29620584bccb9a334afbebb29ebdc8540a8456c0`, with Codex assistance. The Academy interface is undocumented and can change. An empty slot means no class was returned, not confirmed free time. Always review against Academy; this is not university SSO or an official university-supported API.

## Hosted configuration

Set `MOBILITY_PUBLIC_ORIGIN` to the exact HTTPS browser origin, e.g. `https://campuspool-preview.arjunsrikanth17.workers.dev`, in the frontend runtime environment. `deploy/one-box/compose.yml` passes it from the private Compose env file. This is required because the proxy changes the transport Host. Client-supplied forwarded headers are not accepted as proof of origin. Without this setting, the route permits only same-origin loopback development. `MOBILITY_API_ORIGIN` identifies the existing private Laravel server.

The route requires same-origin JSON requests and a valid app session. It bounds actual request bytes to 4096, input-read time to five seconds, Academy requests to 20 seconds and fetched pages to 2 MB. Redirects stay on the fixed PES origin. There is a three-attempt/five-minute per-session/per-process limit; it is not a distributed limiter. Failures expose fixed messages, never upstream exception text or credential values. Academy account challenges, outages, format changes and invalid credentials remain upstream failure cases.

## Verification boundary

Synthetic parser/login/redirect/stream-limit tests, hosted-origin/auth/request-bound tests and UI import-review/save tests verify implementation behavior. They do not establish fresh real-account Academy authentication or timetable accuracy. A public Academy login-page GET may verify availability without using credentials; a successful real import must be separately observed in the deployed UI. Do not paste real credentials into terminal arguments, logs, Git, screenshots or test fixtures.
