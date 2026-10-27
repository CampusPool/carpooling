# Driver onboarding research

Status: read-only research for the private Bengaluru college-community pilot. Checked 21 October 2026. This document records public, official India sources and maps their observable onboarding behavior onto the existing cohort/host approval authority. It does not create an account, upload a document, contact a provider, or claim government verification.

## What the public India flows show

The clearest current public reference is Uber India. Its driver flow has four observable stages:

1. **Sign up:** provide personal and vehicle information online.
2. **Submit documents:** upload the required driver and vehicle documents, or submit them at a local Partner Seva Kendra/Greenlight Hub or partner location.
3. **Review and checks:** Uber says documents are reviewed and verified, with a stated review window of up to 48 hours. Its help page describes a document as rejected or expired when the eligibility, vehicle, or submitted-document requirements are not met.
4. **Activation:** after document submission and screening, the account can be activated; the India driver-requirements page also directs the applicant to bring the car to a local Greenlight Hub. City-specific vehicle requirements apply.

Uber's India document page lists these categories:

- driver’s licence;
- profile photo;
- registration certificate (RC);
- vehicle insurance;
- contract carriage permit; and
- tourist taxi permit.

The India vehicle page adds yellow-plate eligibility, model-year/body/condition requirements, readable current RC, insurance, and tourist permit, plus an NOC/affidavit when the vehicle is in another person's name. The broad India driver page lists age 18+, background screening, proof of residency, a valid licence, vehicle registration/insurance/permit, submission of documents and photo, and a Partner Seva Kendra visit. These are provider requirements and should not be treated as legal advice or as requirements for this pilot.

Uber's upload guidance is also an observable product behavior: show the whole document clearly, use originals rather than photocopies, upload one image or PDF at a time, upload the licence first for cross-checking, and correct/resubmit a rejected or expired document. The public pages do not expose an API contract for automated approval or identify which government database is queried.

Ola's current India public materials are more fragmented. Ola Support's “How to drive with Ola?” page says car attachment requires vehicle insurance, RC book, PAN card, address proof, cancelled cheque, and commercial driving licence; it labels tax receipts, fitness, PUC, and permit certificates as optional on that page. Ola's 2024 India auto driver-partner terms say onboarding collects driver information, vehicle number, driving licence, mobile number, residential address, date of birth and identification proofs. The same terms require valid licence, registration/permits/approvals, and say the driver may be subject to background, driving-record, address-verification, and judicial checks. Ola's driver-partner affidavit lists driving licence, RC, insurance, permit, fitness certificate and other legally required documents as documents submitted during onboarding and requires the driver to keep them valid and updated.

The public Ola material establishes document categories and the possibility of background/record checks, but it does **not** provide a reliable public status-state machine, review SLA, or documented re-upload API. The Ola Support page is useful as a current checklist, while the terms/affidavit explain the contractual expectations; they do not prove that every listed check is performed automatically for every applicant.

## Source links

- [Uber India driver requirements](https://www.uber.com/in/en/drive/requirements/)
- [Uber India required driver documents](https://www.uber.com/in/en/drive/requirements/documents/)
- [Uber India vehicle requirements](https://www.uber.com/in/en/drive/requirements/vehicle-requirements/)
- [Uber Help: rejected or expired documents and resubmission](https://help.uber.com/en/driving-and-delivering/article/ladda-upp-dokument?nodeId=01116d00-abb3-491c-bdbe-eb273d705f44)
- [Ola Support: documents to attach a car](https://help.olacabs.com/support/dreport/214172425)
- [Ola 2024 India auto driver-partner terms (PDF)](https://olawebcdn.com/supply/partner_portal/OLA_Auto_Driver_T_C_20March2024.pdf)
- [Ola driver-partner affidavit (PDF)](https://olawebcdn.com/supply/psob/docs/driver_affidavit_en.pdf)

## Existing implementation authority and gap analysis

The code already has a suitable manual trust boundary:

- `POST /api/mobility/membership/apply` creates a cohort membership in `pending` state.
- `POST /api/mobility/host-applications` requires an approved membership, an owned complete `Car`, and a selected `bike` or `car`; it creates a host application in `pending` state.
- `GET /api/mobility/membership/me` exposes membership, host applications, status, and version to the applicant.
- Operator list/decision endpoints expose the queue and let an administrator decide with an expected version and a required reason. Decisions are audited.
- `CohortPolicy::hostApproved()` and the guards require an active, non-banned user, approved membership, an approved host application, a complete owned vehicle, and an unchanged vehicle fingerprint before publishing or dispatch.

This is enough for a **demo manual review**: an operator can inspect documents outside the system or in a controlled local demo, record a reason, and approve the host application. It is not document verification. There is no document upload/storage, document type or expiry metadata, applicant checklist, OCR, provider API, government-registry lookup, background-check integration, inspection appointment, or proof that any external check occurred.

The current status behavior is narrower than a driver marketplace flow:

- `pending` can become `approved` or `rejected`;
- `approved` can become `suspended`;
- `suspended` can become `approved`;
- `rejected` is terminal; and
- a host application is unique per `(user_id, car_id)`, so a rejected applicant cannot resubmit that same vehicle through the existing endpoint.

Therefore, the UI can truthfully show pending/approved/rejected/suspended today, but it cannot show “needs correction/re-upload,” preserve a document-specific rejection reason, or distinguish an expired document from a failed manual review. A status named `approved` must mean only “approved by this pilot's operator under its cohort policy,” not “verified by Ola/Uber, a government authority, or an automated identity provider.”

## Minimal implementation work packet proposal

Implement this as a bounded extension of the existing membership/host authority after the map and booking priority is stable.

**User journey:** applicant selects an existing owned complete car, sees a checklist, supplies document metadata and local demo references, submits once, sees `pending`; operator reviews the checklist and vehicle against the existing car; operator approves, rejects with a required reason, or requests resubmission; applicant corrects only the requested items and resubmits; only an approved host application can publish/dispatch.

**Smallest contract:** add a host-review document checklist keyed to the host application, with an allowlisted category (`driver_license`, `profile_photo`, `rc`, `insurance`, `permit`, `fitness`, `puc`, `identity_or_address`, `ownership_noc`) and per-item state (`missing`, `submitted`, `needs_resubmission`, `accepted`, `expired`). Store no raw government identifier in this demo. Store only a private/local reference, submitted/expiry timestamps where supplied, reviewer, reason, and version. Keep file retention and access policy explicit before accepting real personal documents.

**Application state:** retain existing `pending`, `approved`, `suspended`, and `rejected` semantics for access control. Add a resubmission path that either introduces `needs_resubmission` (preferred) or creates a new versioned application while preserving the rejected audit history. Do not silently reinterpret the current terminal `rejected` state. Every transition must continue to use the existing operator identity, expected-version check, reason, and audit trail.

**Operator review:** provide a queue detail view that shows the applicant, cohort membership, car fields used by the fingerprint, checklist states, and the exact decision reason. A manual “accepted” checkbox is evidence of an operator decision only. It must not be labelled verified, screened, government-checked, or provider-approved unless a separately integrated provider supplies that evidence.

**Acceptance evidence:** a local test should cover submit → pending, operator approve → publish eligibility, reject with reason → no publish, request resubmission → corrected item → re-review, expiry/suspension → access blocked, stale-version decision → conflict, and vehicle mutation after approval → fingerprint mismatch. Use synthetic documents or metadata-only fixtures; do not collect real IDs or contact Ola/Uber.

**Likely files for a future implementation:** a new mobility migration/model/service for checklist rows, the existing `CohortController` and `CohortPolicy` decision/read paths, operator/applicant UI, and focused cohort tests. This research task intentionally changes none of them; only this document is modified.

## Evidence boundary

The external sources establish public requirements and visible workflow concepts, not parity with their private systems. The pilot's first release can support a transparent operator-reviewed demo with synthetic/local references. Automated document verification, government checks, background screening, payment-provider onboarding, and production retention/security require separate design, provider selection, authorization, and independently verified evidence.
