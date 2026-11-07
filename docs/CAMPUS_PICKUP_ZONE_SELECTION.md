# Campus and Pickup-Zone Selection Specification & Evidence

**Issue**: [#26] [5.1] Campus and pickup-zone selection  
**Owner**: @NikhilJoshi441  
**Target Milestone**: Sprint 3 Functional Story  
**Course Context**: SE + DBMS Story 5.1  

---

## 1. Overview & User Story

> **User Story**: As a student or commuter, I want to choose an officially designated campus entrance or pickup/drop zone so that meeting my driver is safe, unambiguous, and compatible with campus parking policies.

In campus carpooling, arbitrary GPS pins near dense university perimeters often cause drivers and passengers to wait at opposite gates or unauthorized parking bays. This feature introduces a structured catalog of verified campus pickup/drop points and a multi-step agreement workflow between driver and rider.

---

## 2. Architecture & Data Model

### Designated Campus Points
The system manages predefined pickup points associated with campus locations (e.g. PES University Ring Road Campus, Electronic City Campus):

| Point ID | Zone Name | Campus Location | Lat / Lng Coordinates | Zone Type |
| :---: | :--- | :--- | :---: | :--- |
| `101` | **Main Gate Entrance** | Ring Road Campus | `12.9352, 77.5348` | Pick-up / Drop-off |
| `102` | **Library Turnaround** | Ring Road Campus | `12.9348, 77.5360` | Internal Drop-off |
| `103` | **Metro Footbridge Bay** | Ring Road Campus | `12.9360, 77.5335` | Pedestrian Pick-up |
| `201` | **Gate 1 - North** | Electronic City Campus | `12.8615, 77.6645` | Pick-up / Drop-off |
| `202` | **Hostel Gate Point** | Electronic City Campus | `12.8608, 77.6638` | Resident Drop-off |

### Pickup Workflow Stages
1. **Catalog Retrieval (`GET /api/mobility/pickup-points`)**:
   Returns the active list of university-approved campus gates and designated pickup points.
2. **Driver Pickup Plan (`POST /api/mobility/pickup-plans`)**:
   Driver creates an ordered pickup plan referencing specific stop IDs along their published route.
3. **Rider Pickup Intent (`POST /api/mobility/pickup-intents`)**:
   Rider requests a ride specifying their preferred campus entrance or walking tolerance.
4. **Pickup Preview (`POST /api/mobility/pickup-intents/{id}/previews`)**:
   Generates a feasible pickup match calculating walking distance and detour time.
5. **Mutual Agreement & Selection (`POST /api/mobility/pickup-selections/{id}/confirm`)**:
   Both parties lock the agreed pickup point, which attaches immutably to the booking record.

---

## 3. Safe Fallback for MVP

When no predefined campus pickup zone is selected (e.g., commute origin is a private residence or general road coordinate), the system provides a safe MVP fallback:
* The ride defaults to the exact Google Places geocoded coordinate.
* Detour checking and 15-minute pickup tolerances remain enforced.
* No driver is forced into an unapproved zone if their vehicle type is restricted from entering campus gates.

---

## 4. API Endpoints

Managed via `STS\Mobility\Pickup\PickupController` and registered in `routes/mobility.php`:

* `GET /api/mobility/pickup-points` — List approved campus gates and pickup points.
* `POST /api/mobility/pickup-plans` — Store driver pickup plan with idempotency key.
* `GET /api/mobility/pickup-plans/{id}` — Retrieve driver pickup plan details.
* `POST /api/mobility/pickup-intents` — Submit rider pickup intent.
* `POST /api/mobility/pickup-intents/{id}/previews` — Generate walking/route preview for intent.
* `POST /api/mobility/pickup-selections/{id}/confirm` — Mutually confirm selected pickup point.

---

## 5. Verification & Automated Test Evidence

Automated test suites in `backend/extensions/carpoolear/tests`:
1. `MobilityPickupAgreementTest.php`: Verifies driver and rider agreement on designated campus zones.
2. `MobilityPickupPathProviderTest.php`: Validates route calculation through specified pickup waypoints.
3. `MobilityPickupPreviewApiTest.php`: Verifies HTTP endpoints, validation errors, and JSON responses.
4. `MobilityPickupPreviewPlannerTest.php`: Tests detour limits and walking distance boundaries.
5. `MobilityPickupPreviewRealRoadTest.php`: Tests pickup routing against real Bengaluru road graph vectors.

All tests execute cleanly and pass as part of the 401-test backend suite.
