# CampusPool teacher demonstration

**Audience:** SE + DBMS mini-project review · **Scope:** synthetic local driver/rider accounts, route-aware ride matching and database transactions.

**Do not improvise installation during the review.** Set up and test the environment beforehand; if a real Maps provider or Docker engine is unavailable, explain the limitation rather than pretending the demo is fully live. This guide describes the tested UI and an optional database explanation; it does not promise the application starts from a bare Git clone.

## Before the review

1. Use a clean clone of **draft PR #92** (or a later owner-approved merge) and follow [RUN_LOCAL_CORE.md](../RUN_LOCAL_CORE.md). Provide your own restricted Ola credentials in an ignored, mode-600 configuration file. Docker, Node, Python, Git and normal internet are required; **no Bengaluru OSM crop or OSRM runtime is required**.
2. Check configuration with **python3 scripts/run-local-core.py --provider ola --check**, then start using **sh scripts/run-local-core.sh --provider ola --project mobility-core-ola-teacher**. The default frontend is http://127.0.0.1:3012. Choose a unique Docker project/context rather than reusing your teammate's data.
3. Use a normal browser profile for the driver and an independent/incognito one for the rider.
4. Confirm real Ola map tiles, Places selection, routing and Laravel/MySQL health *before* presenting. Register fresh synthetic accounts in the tested Bengaluru area.
5. Choose the next day or later, using the same future date and compatible route on both accounts; the driver's start must be at least 15 minutes from now.
6. Keep [feature status](FEATURE_STATUS.md), [Ola acceptance evidence](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md) and a harmless SQL query handy. Never display provider keys, bearer tokens, passwords or private user data.

## Show the teacher (target: 6–10 minutes)

| Order | Driver browser | Rider browser | What it demonstrates |
| --- | --- | --- | --- |
| 1 | Create a local **driver** account | Create a local **rider** account | Persisted roles and authentication, **not** official university identity |
| 2 | Search **Pickup place** and **Destination place** using real Ola Places | Select the same route and departure date/time | Real geocoding, routing preview and time constraints |
| 3 | Click **Publish ride** | — | Server validates the route and creates a published offer |
| 4 | — | Click **Find rides** and **Request seat** on the matching offer | Database-backed matching and seat-request transition |
| 5 | Refresh updates, then **Accept rider** | Observe accepted request | Capacity and booking state transitions |
| 6 | — | Under the demo wallet, **Add 500 demo credits** and **Confirm demo payment** | Synthetic ledger/hold; **not real payments** |
| 7 | Open **Chat & location**; send a message | Open the same trip chat and reply | Participant-scoped messaging |
| 8 | **Start ride**, **Mark rider picked up**, **Mark rider dropped off**, **Complete ride** | Observe lifecycle | Ordered trip transitions and persistent history |
| 9 | — | Refresh and **Confirm arrival** | Completed booking and arrival acknowledgement |

> The separate real Ola browser journey passed these 19 functional checkpoints. Its observed synthetic fare was **₹60.44**, and the rider added **₹500 demo credits** before holding the fare. Prices depend on routes. Direct SQL inspection confirmed a completed booking, accepted rider, hold, two messages and four lifecycle events. There was **no actual money settlement**; delayed demo release/receipt was not E2E-certified.

## What to explain about the architecture (roughly one minute)

- **Next.js** handles the student's web UI, local session interactions, place selection and route preview using Ola Maps.
- **Laravel + MySQL** manages account roles, driver offers, route-aware matching, seat inventory, booking actions, synthetic money records, chat and trip status.
- **Ola Directions** replaces compulsory OSRM graph services for driving/walking routes, snapping and distance. The old OSRM path is preserved only as a separate rollback.
- **MongoDB projection** is an **optional analytics read model**, not the booking database. Booking correctness must still work when the projection service is unavailable.
- The pinned [upstream Carpoolear backend](../THIRD_PARTY_NOTICES.md) is reconstructed at startup; do not imply all Laravel core code is original team work.

See [Architecture](ARCHITECTURE.md) and the [actual ERD/data dictionary](dbms/README.md).

## DBMS viva: questions you can demonstrate

| Likely question | Where to point | What to say |
| --- | --- | --- |
| “Where does the booking live?” | `backend/extensions/carpoolear/Mobility/`, MySQL migrations and [data dictionary](dbms/ACTUAL_DATA_DICTIONARY.md) | MySQL is authoritative; use a disposable demo row to explain trip/request/seat relations |
| “What prevents double booking?” | Booking state changes and [transaction/concurrency notes](dbms/ACTUAL_SCHEMA_DESIGN_NOTES.md) | Explain DB transactions, constraints/locks and regression cases; don't claim all possible races are formally proven |
| “Where are your queries and indexes?” | [Application analytics](dbms/APPLICATION_ANALYTICS.md) and [performance evidence](dbms/PERFORMANCE_TUNING_REPORT.md) | Show indexed queries, actual SQL objects and measured environment; distinguish fixtures from real app data |
| “Why MongoDB?” | [Activity projection](../services/activity-projection/README.md) | Derived lifecycle analytics, separate from normalized booking data; replayable if unavailable |
| “Is this live payment or GPS?” | [Feature status](FEATURE_STATUS.md) | **No**: wallet is synthetic; real payment/physical-device GPS remain pending |
| “Is the university approving pickup zones?” | [Campus pickup spec](CAMPUS_PICKUP_ZONE_SELECTION.md) | Demo catalog points are examples; university approval must be separately obtained |

## Troubleshooting during the review

- **Map/Places unavailable:** Check the Ola Maps browser-key allowed origins, server key, enabled APIs, provider quota and connectivity. An unverified typed coordinate is not an Ola Places result.
- **No matching ride:** Confirm same date, route, seats, mode, walking tolerance and driver acceptance state; use fresh accounts and do not reuse a closed trip.
- **Docker/project collision:** Use a unique managed project/context; never delete someone else's Docker containers or database.
- **Missing Ola key/network:** The static app/database may start with test credentials, but real map and routing needs a valid restricted Ola key. No PBF crop is needed in Ola mode. Use [independent evidence](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md) if provider access is unavailable.

## After the demonstration

Stop the local UI with Ctrl-C. Preserve the managed disposable database when you intend to resume; use the exact project/context identity from the runbook. Never run `docker compose down -v` on a preserved environment or accidentally seed a teammate's database.

**Course boundary:** A passing demo and green CI are not proof of instructor acceptance, team-size permission or original authorship. Be ready to explain which work was written, adapted, integrated, or AI-assisted by each teammate.
