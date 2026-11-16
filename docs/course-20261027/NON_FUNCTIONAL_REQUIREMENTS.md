# CampusPool non-functional requirements

Working requirements for the student preview, 16 November 2026. These are acceptance targets, not claims of measured performance or instructor approval. The team must agree any outstanding numerical targets and record results against the deployed revision in the [test plan](TEST_PLAN_CURRENT.md).

| ID | Quality | Requirement and verification |
| --- | --- | --- |
| NFR-01 | Authentication and authorization | The server shall authenticate protected requests and enforce ownership and role permissions; test anonymous, cross-user and unauthorized access. [#38](https://github.com/CampusPool/carpooling/issues/38) |
| NFR-02 | Confidentiality | Public access shall use HTTPS; credentials, tokens and sensitive personal information shall not appear in repository files or application logs. Inspect deployment configuration and representative logs. |
| NFR-03 | Input security | The server shall validate untrusted input and return controlled errors without exposing secrets or stack traces; exercise invalid and unauthorized requests. [#38](https://github.com/CampusPool/carpooling/issues/38) |
| NFR-04 | Data integrity | Booking changes shall preserve capacity and valid ride states under concurrent requests; verify persisted state with transaction and concurrency tests. [#37](https://github.com/CampusPool/carpooling/issues/37) |
| NFR-05 | Privacy | Trip chat, account data and safety information shall be accessible only to authorized users; test access using unrelated accounts. |
| NFR-06 | Usability | Primary student journeys shall be usable on mobile and desktop screens, with visible validation and understandable empty and error states; inspect both layouts and keyboard operation. [#42](https://github.com/CampusPool/carpooling/issues/42) |
| NFR-07 | Accessibility | Forms shall have identifiable labels, usable keyboard focus and readable contrast; check primary flows with keyboard and automated accessibility tooling. |
| NFR-08 | Performance | Record response times for sign-in, ride search and booking under an agreed representative workload; define and approve numerical thresholds before making performance claims. [#41](https://github.com/CampusPool/carpooling/issues/41) |
| NFR-09 | Availability and recovery | Document hosting limitations, backup and restoration procedures, and dependencies; verify recovery on a disposable environment. No uptime guarantee is established for the preview. |
| NFR-10 | Maintainability | Changes shall use version control and a reviewable pull request, with setup instructions and automated checks for affected behavior. [#39](https://github.com/CampusPool/carpooling/issues/39), [#44](https://github.com/CampusPool/carpooling/issues/44) |
| NFR-11 | Testability | Maintain a traceable test plan covering functional, security and integrity scenarios, with results and known limitations recorded for the tested revision. [#43](https://github.com/CampusPool/carpooling/issues/43) |
| NFR-12 | Provider resilience | Routing or email provider failures shall produce a clear failure state without reporting an operation as successful; test with unavailable or rejected provider responses. |
| NFR-13 | Demo transparency | Simulated vehicles, wallet activity and any test data shall be identifiable as simulated; real payment or identity verification shall not be implied. |
| NFR-14 | Data and operations | Schema changes shall preserve existing data and provide a documented rollback or recovery plan; database and MongoDB requirements must be verified in the intended environment. [#36](https://github.com/CampusPool/carpooling/issues/36), [#40](https://github.com/CampusPool/carpooling/issues/40) |

Issue status is not proof that these requirements are met. Numerical performance, load, availability and recovery targets remain to be agreed and measured.
