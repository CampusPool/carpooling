# Ola migration: sprint and contributor continuity

The [project board](https://github.com/orgs/CampusPool/projects/2) and original sprint issues preserve the work that preceded the move to Ola. Ola integration is in [PR #100](https://github.com/CampusPool/carpooling/pull/100); older Google/OSRM acceptance records describe the earlier provider and must not be presented as proof of the current pickup experience.

| Earlier story | Continuing contribution |
| --- | --- |
| [#17](https://github.com/CampusPool/carpooling/issues/17), [#22](https://github.com/CampusPool/carpooling/issues/22) | Nikhil's route discovery and integrity integration, [PR #86](https://github.com/CampusPool/carpooling/pull/86). Direction, time, capacity and booking integrity remain relevant. |
| [#21](https://github.com/CampusPool/carpooling/issues/21) | Zayaan's integrated ride UI, [PR #87](https://github.com/CampusPool/carpooling/pull/87), building on the publication backend in [PR #84](https://github.com/CampusPool/carpooling/pull/84). |
| Pedestrian routing | Zayaan's OSRM snapping fix, [PR #93](https://github.com/CampusPool/carpooling/pull/93), documented a real wide-road issue. Ola has different provider validation and requires its own verification. |
| [#44](https://github.com/CampusPool/carpooling/issues/44) | Arjun's runtime setup, provenance and recovery work, [PR #88](https://github.com/CampusPool/carpooling/pull/88). The OSRM setup is historical; recovery and traceability still matter. |
| [#24](https://github.com/CampusPool/carpooling/issues/24) | Nithesh's assigned cancellation and seat-capacity story remains applicable independently of routing. |
| [#41](https://github.com/CampusPool/carpooling/issues/41), [#43](https://github.com/CampusPool/carpooling/issues/43) | Nikhil's performance and test-traceability work, including [PR #89](https://github.com/CampusPool/carpooling/pull/89). Old-provider measurements are not Ola benchmarks. |

This table credits the documented issue assignments and linked contributions; it does not assert who independently authored every line or imply course approval. The old issue text, PRs, assignees and Git history remain available.

The current Sprint 3 pickup story is [#101](https://github.com/CampusPool/carpooling/issues/101): the rider's combined walk to pickup and from drop-off must be strictly below 1 km, and both pickup arrangements need clear presentation and verification. Driver detour distance is a separate preference. Provider-backed two-account and boundary acceptance remain pending until actual evidence is linked. Demo contribution amounts are not real payments.

An isolated 14 November development test with synthetic users and live Ola routing returned an on-route match for a rider placed approximately 300 m in straight-line distance from the driver's start. The returned approach includes walking geometry, the meeting point and a sub-1-km calculated combined walk. A separate Ola-backed test requested and accepted a direct-pickup quote, then checked that a subsequent rider uses the agreed route. These are backend test journeys, not a two-person hosted browser acceptance or proof that every unmapped access gap is physically walkable.
