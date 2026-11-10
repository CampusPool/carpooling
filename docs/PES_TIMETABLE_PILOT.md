# PES Academy timetable pilot

This is a reviewable demonstration, not a verified or approved university integration. A local rider or driver can open **My timetable**, enter their Academy SRN and password, and review the weekly grid. The Next.js server signs in to Academy and requests its timetable page. The application does not intentionally save the password or Academy cookies; they are used transiently for the request. Saving stores only the displayed timetable entries against the signed-in app account in MySQL. Delete removes that stored timetable. The app does not import the timetable into ride matching or apply a travel buffer.

The grid reflects entries that the Academy endpoint returned. A dash means no entry was returned, not that the student is free. Some returned slots may contain multiple choices; the three specifically identified `UE24AM342AA1`, `UE24AM342AA4`, and `UE24AM342AA5` options are represented as `Elective`. Other overlaps are flagged, and saving is blocked until resolved outside this pilot. This is a narrow rule, not a general mapping of elective courses. The actual elective subject is deliberately not saved. The endpoint and page format are undocumented and may change. In one live comparison the feed differed from a section timetable image; the code cannot determine which is correct. Review the schedule before relying on it.

## Security and scope

- Credentials pass through the application server to Academy. Use only a trusted local, loopback demo. This prototype is not approved for public deployment or for collecting other students' credentials.
- The importer rejects redirects outside the PES origin and does not intentionally persist cookies, passwords, SRNs, or raw Academy responses. Do not log request bodies, credentials, personal timetable data or session cookies. Browser password managers or infrastructure outside the app may retain data.
- The route checks the app session and origin and has a small **per-process** attempt limit; this is not distributed rate limiting. A 20-second request timeout exists, but response and request body size enforcement needs hardening before production. An independent security, privacy, authorization and university-policy review is required.
- The database row is scoped to the app account. The endpoint is not a university SSO integration, and the university's terms and permission for this method are unverified. Session expiry, challenges, upstream changes and overlapping classes may prevent import.
- The demo does not verify the accuracy or completeness of the provider schedule, infer elective enrollment, enable maps, or modify production data. Do not use this pilot to make real attendance or ride decisions.

## Verification

From `frontend-next`, run `npm ci`, `npm test`, and `npm run build`. The tests use synthetic timetable data, including elective grouping, unknown overlap handling, import errors and saving, and mocked Academy login/redirect behavior. Backend tests must run via the repository's disposable MySQL harness, never against an existing pilot database. Reconstruction is checked with `sh research/experiments/carpoolear/verify-reconstruction.sh`. Real account testing is a separate manual test and must never place credentials in code, terminal commands, screenshots, or reports.
