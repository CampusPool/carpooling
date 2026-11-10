# CampusPool teacher demonstration

**Audience:** SE + DBMS mini-project review · **Scope:** synthetic local driver/rider accounts, route-aware ride matching and database transactions.

**Do not improvise installation during the review.** Set up and test the environment beforehand; if a real Maps provider or Docker engine is unavailable, explain the limitation rather than pretending the demo is fully live. This guide describes the tested UI and an optional database explanation; it does not promise the application starts from a bare Git clone.

## Before the review

1. Use a clean clone of the current `main` and follow [RUN_LOCAL_CORE.md](../RUN_LOCAL_CORE.md). Supply the **exact checksum-verified Bengaluru OSM crop** separately and a **private Google browser key**; use a disposable Docker database, not pilot data.
2. Run `sh scripts/run-local-core.sh --dataset /absolute/path/to/the-verified.osm.pbf --maps-config .local/maps-demo/google.json --check` first, then run the same command without `--check` to start the stack. The usual frontend address is `http://127.0.0.1:3012/`.
3. Open **one normal browser profile for the driver and one private/incognito profile for the rider**. Two tabs in one profile will share the same login session.
4. Confirm map tiles, Google place suggestions, database connectivity and both browser sessions **before** presenting. Use two fresh *synthetic* demo accounts. Pick locations within the configured Bengaluru routing crop.
5. Choose a **future departure at least 15 minutes from now** (India time) and exactly the **same date and compatible route** for both accounts. To avoid accidental clock rollover during the review, schedule the next day or later. Keep the two route endpoints distinct.
6. Keep the terminal displaying the real runtime checks and the repository's [feature-status table](FEATURE_STATUS.md) open as fallback proof; never display the private Maps key, password or unredacted user data.

## Show the teacher (target: 6–10 minutes)

| Order | Driver browser | Rider browser | What it demonstrates |
| --- | --- | --- | --- |
| 1 | Create a local **driver** account | Create a local **rider** account | Persisted roles and authentication, **not** official university identity |
| 2 | Search **Pickup place** and **Destination place** using real Google Places | Select the same route and departure date/time | Real geocoding, routing preview and time constraints |
| 3 | Click **Publish ride** | — | Server validates the route and creates a published offer |
| 4 | — | Click **Find rides** and **Request seat** on the matching offer | Database-backed matching and seat-request transition |
| 5 | Refresh updates, then **Accept rider** | Observe accepted request | Capacity and booking state transitions |
| 6 | — | Under the demo wallet, **Add 500 demo credits** and **Confirm demo payment** | Synthetic ledger/hold; **not real payments** |
| 7 | Open **Chat & location**; send a message | Open the same trip chat and reply | Participant-scoped messaging |
| 8 | **Start ride**, **Mark rider picked up**, **Mark rider dropped off**, **Complete ride** | Observe lifecycle | Ordered trip transitions and persistent history |
| 9 | — | Refresh and **Confirm arrival** | Completed booking and arrival acknowledgement |

> The previous isolated browser test completed all of these steps, including a route around 7.7 km. Its final fare was **₹70.52 in synthetic credits**, not a promised fixed price for arbitrary routes. Do **not** claim credit-release/receipt settlement completed: the waiting-period release was not part of that test.

## What to explain about the architecture (roughly one minute)

- **Next.js** handles the student's web UI, local session interactions, place selection and route preview using Google Maps.
- **Laravel + MySQL** manages account roles, driver offers, route-aware matching, seat inventory, booking actions, synthetic money records, chat and trip status.
- **OSRM** (for the current revision) uses a separately supplied Bengaluru road graph to evaluate real driving/walking routes and detours on the backend. This is why a Google browser map does not eliminate the dataset in the *current* implementation. Replacing it with a hosted routing provider is planned, not complete.
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

- **Map/Places unavailable:** Verify Maps JavaScript + Places API (New), key restrictions, billing, localhost referrer and browser network access. Map-click selection can substitute *when Maps JS loads but Places suggestions fail*; do not claim this tests real Google Places.
- **No matching ride:** Confirm same date, route, seats, mode, walking tolerance and driver acceptance state; use fresh accounts and do not reuse a closed trip.
- **Docker/router collision:** Another checkout may own a globally named routing container. Use a dedicated Docker/Colima context as the [setup runbook](../RUN_LOCAL_CORE.md) specifies; don't delete another team's data.
- **No externally provided OSM crop/key:** Full live demo cannot start, even though the repository and CI work; use the sanitized [integration evidence](engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md) to explain what was tested and disclose the missing prerequisite.

## After the demonstration

Stop the local UI with Ctrl-C. Preserve the managed disposable database when you intend to resume; use the exact project/context identity from the runbook. Never run `docker compose down -v` on a preserved environment or accidentally seed a teammate's database.

**Course boundary:** A passing demo and green CI are not proof of instructor acceptance, team-size permission or original authorship. Be ready to explain which work was written, adapted, integrated, or AI-assisted by each teammate.
