# CampusPool functional requirements

Working requirements for the student carpooling preview, 16 November 2026. These describe intended behavior, not a claim that each feature has been independently verified or accepted. See the [scope review](COURSE_REVIEW_2026-11-14.md), [test plan](TEST_PLAN_CURRENT.md), and linked issues for evidence and remaining work.

| ID | Requirement | Related issue |
| --- | --- | --- |
| FR-01 | The system shall support eligible student account registration and email verification. | [#8](https://github.com/CampusPool/carpooling/issues/8) |
| FR-02 | The system shall let students sign in and recover account access through the supported email flow. | [#9](https://github.com/CampusPool/carpooling/issues/9) |
| FR-03 | A student shall be able to view and update their profile and relevant ride preferences. | [#11](https://github.com/CampusPool/carpooling/issues/11) |
| FR-04 | A driver shall be able to select vehicle details and offered seats from the demo catalogue. | [#12](https://github.com/CampusPool/carpooling/issues/12) |
| FR-05 | A driver shall be able to publish a ride with origin, destination, departure time and available seats. | [#21](https://github.com/CampusPool/carpooling/issues/21) |
| FR-06 | A rider shall be able to search for compatible rides using places and departure time and inspect the results. | [#22](https://github.com/CampusPool/carpooling/issues/22), [#101](https://github.com/CampusPool/carpooling/issues/101) |
| FR-07 | The system shall use the configured routing provider to show route and pickup information and apply the matching rules. | [#17](https://github.com/CampusPool/carpooling/issues/17), [#101](https://github.com/CampusPool/carpooling/issues/101) |
| FR-08 | A rider shall be able to request a seat; the driver shall be able to accept or reject the request. | [#23](https://github.com/CampusPool/carpooling/issues/23) |
| FR-09 | Authorized participants shall be able to cancel according to the ride state, with seat capacity updated accordingly. | [#24](https://github.com/CampusPool/carpooling/issues/24) |
| FR-10 | Participants shall receive in-app booking updates and be able to communicate through the supported trip chat. | [#31](https://github.com/CampusPool/carpooling/issues/31), [#32](https://github.com/CampusPool/carpooling/issues/32) |
| FR-11 | Authorized participants shall be able to progress an accepted ride through its supported lifecycle. | [#81](https://github.com/CampusPool/carpooling/issues/81) |
| FR-12 | The application shall show simulated wallet or shared-cost information clearly as demo activity. | [#25](https://github.com/CampusPool/carpooling/issues/25), [#34](https://github.com/CampusPool/carpooling/issues/34) |
| FR-13 | A student shall be able to submit feedback for a completed ride and use supported safety controls, including a trusted-contact flow where available. | [#13](https://github.com/CampusPool/carpooling/issues/13), [#15](https://github.com/CampusPool/carpooling/issues/15) |
| FR-14 | Where timetable import is offered, the student shall review imported information before saving it. | [#27](https://github.com/CampusPool/carpooling/issues/27) |

Real-money settlement, physical live GPS and university administration integration are outside the current student-preview scope. Timetable import is a pilot with no established university API approval. Open issues, provider behavior and end-to-end journeys require separate verification; an issue's closed state alone does not establish acceptance.
