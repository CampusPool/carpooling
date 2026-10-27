# Questions and decision register

17 October 2026. This records the questions currently needed to plan the full product and assess the requested public launch. It is not a demand to answer every future design question before work starts. Agents should research technical facts; humans own product intent, money/accounts and operating responsibilities. Unknown answers stay unknown, with dependent work identified.

## Answers already received

| Topic | User answer |
| --- | --- |
| Product modes | Both scheduled/recurring carpool and on-demand rides, as distinct modes. |
| Date and release type | Actual rides and payments for college-community members on 21 October 2026, with Bengaluru-wide route coverage but cohort-limited access. A web app or software client is acceptable; do not substitute a private demo. |
| Team | Two students. |
| AI access | Two ChatGPT Plus accounts. Separate API budget is unconfirmed. |
| Existing assets | No existing product assets/source/backend supplied. Can download Hopr APK/store app. |
| Devices | MacBook, Android phone and spare Android. No iPhone confirmed. |
| Cloud | None currently; possible Azure student access through GitHub/student eligibility. Not activated/verified. |
| Money flow | Both cash and UPI are desired. An active UPI account was previously reported; provider is now undecided, so API merchant functionality remains unverified. Collect first; release to the driver after trip completion and rider arrival. Provider callbacks, refunds, settlement and reconciliation remain unverified. |
| Source privacy | Private development; an open-source release is acceptable (latest explicit user answer). The separate product repository is private; public publication remains separately authorized. |

## Immediate decisions: answer these first

| ID | Question | Owner / why it matters |
| --- | --- | --- |
| Q01 | Answered: Bengaluru, bikes and cars; initial cohort is the college community, with routes spanning the city. | User; operating boundaries and supply still need definition. |
| Q02 | What is the exact deadline time, and how many focused hours can each teammate work on Oct 17-21? | Both humans; establishes actual staffing/capacity. |
| Q03 | Who is the teammate, what are each person's strongest languages/frameworks, and what computer/OS do they have? | Both humans; allocates work and avoids selecting an unmaintainable backend. |
| Q04 | Answered: INR 3,000–7,000/month for services excluding existing ChatGPT subscriptions. First-month setup allowance remains unconfirmed. | User; no service purchase authorized by this budget answer. |
| Q05 | Resolved by later user authorization: a separate private product repository was created; keep the old course repo separate. | Coordinator verified private; no visibility mutation of the old organization repo. |
| Q06 | Can you provide the APK's local path after downloading it, and log into reference test accounts on the Androids? Does existing authorization cover observation only, or any source/assets/branding reuse? | User; begin actual reference evidence without confusing it with ownership of Hopr. Never paste credentials into this document. |
| Q07 | Earlier active UPI account claim is qualified by the latest answer: provider not decided. API access, collection, linked-driver transfers, callback/refund/settlement support and pricing remain unverified; do not enter credentials in Git or chat. | Account/operating owner; payment integration and reconciliation remain launch gates. |
| Q08 | Who are the initial real drivers/hosts and riders, how many, and how will they be onboarded and verified? | Product/operations owner; software alone cannot supply a marketplace. |
| Q09 | How will users obtain the app: direct Android installation, Play Store, web app, or another channel? Are publisher/signing/domain accounts available? Is iOS required by October 21? | User; distribution/review/device testing are independent of coding. |
| Q10 | Answered: the two student owners will handle first-launch support, safety escalation and verification. Refund coverage and backup availability still need an operating procedure. | User; public physical-world operations need a real response path. |

Q01-Q10 are not prerequisites for all research, but they govern the release recommendation. If an answer is unavailable, assign an owner and deadline and report its impact; do not invent a favorable assumption.

## Required before public trips and money

| ID | Question | Owner / gate |
| --- | --- | --- |
| Q11 | Is this peer cost-sharing, a commercial transport marketplace, or two separately governed offerings? Who is the service operator/entity? | User/qualified operating reviewer; G0/G6. |
| Q12 | Which requirements apply to the selected geography, vehicle category, insurance, driver verification, taxes and payment arrangement, and who will confirm them? | Researcher plus accountable qualified owner; G6. Do not assume a university project exemption. |
| Q13 | When does a passenger pay: request, acceptance, pickup or completion? Who bears failed-payment risk? | Product/payment owner; state and money contracts. |
| Q14 | How are quotes calculated, how long are they valid, and how do fare splits differ from commercial ride prices? | Product/payment owner; G4/G5. |
| Q15 | Who receives funds, when are payouts eligible, and who absorbs fees, refunds, chargebacks and failed settlements? | Payment/operating owner; G5/G6. |
| Q16 | What happens for driver cancellation, rider cancellation, no-show, early termination and payment success after booking expiry? | Product/payment owner; failure scenarios. |
| Q17 | What identity/vehicle verification is required, who reviews failures, and how are account restrictions appealed? | Trust/operations owner; G5/G6. |
| Q18 | What safety features can we actually operate: trusted-contact sharing, reporting, blocking, emergency contact or staffed response? What does each label promise? | Safety owner; public user promises. |
| Q19 | Which location/chat/identity data is collected, who may access it, and how long is it retained/deleted? | Product/privacy owner with applicable review; G6. |
| Q20 | What is the target operating window and escalation response time? Who can suspend rides, disable payment or take the service offline? | Operations owner; incident runbook. |
| Q21 | Which hosted region, spend cap, domain/TLS owner and backup/restore commitments are affordable? Has Azure eligibility/offer permitted use been checked? | Hosting/account owner plus platform agent; G6. |
| Q22 | What exact user load and launch cohort are expected, and what capacity evidence is required before expanding them? | Product owner plus performance agent; measurable scope. |
| Q23 | Are we willing to change the launch date if payment, safety, distribution or correctness gates are not met? Who makes the final release decision? | User; no assumption that a deadline waives a gate. |

## Product choices that can be resolved progressively

| ID | Question | Owner / when |
| --- | --- | --- |
| Q24 | What original name, identity, visual style and languages will our product use? Is branded Hopr reproduction expected or an original product with feature parity? | User/design owner; before UI/distribution. |
| Q25 | Can users switch rider/host/driver modes? Are commercial driver and peer host eligibility different? | Product owner; identity model. |
| Q26 | Are carpool bookings host-approved or instantly confirmed? Do pending requests reserve capacity, and for how long? | Product owner informed by reference evidence; booking contract. |
| Q27 | Are multi-stop passenger pickups/dropoffs and route-segment seat reuse required at launch? What detour/walking thresholds apply? | Product owner; matching/capacity tests. |
| Q28 | How are recurring schedules edited: one occurrence, all future occurrences, or entire series? What is the timezone policy? | Product owner; recurrence contract. |
| Q29 | How does on-demand assignment work: one offer at a time or competing offers, acceptance timeout, radius expansion and reassignment? | Product owner plus backend specialist; dispatch contract. |
| Q30 | How do participants confirm pickup/start/completion? Is an OTP needed, and what is the offline fallback? | Product/safety owner; trip contract. |
| Q31 | Is continuous background location required? What battery/privacy behavior is acceptable when users deny permissions or lose connectivity? | Product/device owner; device evidence. |
| Q32 | Which communication channels are essential: in-app chat, push, SMS, calls or masked calling? What provider budget exists? | Product/account owner; provider plan. |
| Q33 | Which campus, workplace, community/group and referral features from Hopr research must be supported? | Product owner; full inventory, not inherited coursework scope. |
| Q34 | What specifically would make this better than Hopr: matching success, clarity, cost, cancellation reliability, pickup experience, accessibility or another measurable outcome? | User plus research; experiment prioritization. |
| Q35 | Who can see precise pickup/dropoff and trip history before/after confirmation? What blocking rules override matching? | Product/privacy owner; access tests. |
| Q36 | Which admin actions are allowed and audited: verification, trip intervention, refund, support access, pricing and suspension? | Operations owner; control-plane contract. |
| Q37 | What adoption/driver-earnings and cost-per-trip targets make the service sustainable? Are incentives/subsidies funded? | Product/finance owner; marketplace plan. |
| Q38 | Which capabilities may be deferred if the complete two-mode inventory cannot pass by October 21? Any changed scope must be explicit. | User; feasibility branch, not presumed consent. |

## Research the agents should answer

| ID | Investigation | Expected evidence |
| --- | --- | --- |
| R01 | What is actually inside the APK and which frameworks/ABIs/version/signing facts are present? | Hash, tool output, evidence path and bounded conclusions. |
| R02 | Which REA operations genuinely work on this host and artifact? | Readiness plus successful analysis, not a setup claim. |
| R03 | What user journeys, rules, error states and API contracts can be observed? | Versioned matrix with advertised/observed/inferred/unknown labels. |
| R04 | Which proposed backend can run independently with our hardware and resources? | Recorded clean startup, provider boundaries and baseline tests. |
| R05 | Which candidate actually supports each mode, recurrence and segment capacity? | Source paths and executed scenarios; unknowns remain visible. |
| R06 | What adaptation, patch debt and upstream upgrade path does each candidate imply? | Extension map and small representative change. |
| R07 | What are the source/license/dependency obligations under the intended use? | License inventory and questions for accountable review; do not assume private repo settles it. |
| R08 | Which supported SDKs/providers fit region, payments, maps, SMS and verification, and how long does activation actually take? | Official docs plus verified account status. |
| R09 | What deployment form fits actual student entitlements and operating budget? | Service/resource inventory, current quoted costs, limits and permitted-use check. |
| R10 | What transport/operating/privacy requirements apply once geography/model are specified? | Current authoritative sources; qualified owner confirms application. |
| R11 | What automated tests and failure injectors cover booking, assignment, ledger and reconnect invariants? | Runnable test plan tied to integrated revisions. |
| R12 | What user/device/provider outcomes have really been tested? | Real versus simulated/sandbox evidence and distribution checks. |
| R13 | What peak workload, geographic hotspots and bottlenecks determine capacity/cost? | Measured performance report; no scale claims from upstream reputation. |
| R14 | Does a spec/task tool reduce repeated work in our actual loop? | One controlled trial and clear retain/reject decision. |
| R15 | What does each framework or integration modify, upload, cost and require? | Pinned version, generated-file diff, credential scope and harmless operation proof. |
| R16 | Is the public-launch target feasible at each checkpoint, and which exact dependency controls it? | Updated critical path with evidence, owner and next action. |
| R17 | Can reference extracts be shared safely with agents/tools? | Private original storage, redacted identifiers/secrets/locations, reviewed screenshots/traces and minimal context packets before ingestion. |

## How answers change work

Product decisions become concise entries in DECISIONS.md; durable constraints update PROJECT.md. Technical findings attach to the relevant work packet. Record who answered, date, source/evidence and confidence. Revisit only when new evidence changes the decision. Do not repeatedly ask settled questions or block unrelated research while one answer is pending.

Latest answers: Bengaluru (Bangalore); bikes and cars; UPI and cash. User requires initial payment collection and driver release after completion and rider arrival; wallet versus UPI interface remains flexible. See [payment contract](PAYMENTS.md). Merchant activation, exact payment timing, fees/refund rules and completion fallback remain unanswered. These answers authorize local implementation, not live money movement or public release.
