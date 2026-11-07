# Ride Reminders, Change Alerts, and Trip Communications

**Issue**: [#33] [6.3] Ride reminders and changes  
**Owner**: @NikhilJoshi441  
**Target Milestone**: Sprint 3 Stretch Story (Epic 6)  
**Course Context**: SE + DBMS Story 6.3  

---

## 1. Overview & User Story

> **User Story**: As a ride participant (rider or driver), I want to receive timely departure reminders, immediate notifications when a ride is altered or cancelled, and in-app trip messaging so that travel plans remain synchronized without miscommunication.

---

## 2. Notification Architecture & Schedule Rules

### 1. Departure Reminder Timing
* Reminders are calculated relative to `trips.trip_date` converted to the user's localized timezone (`Asia/Kolkata`).
* Default reminder window: **60 minutes** and **15 minutes** prior to planned departure.
* Only participants with `accepted` booking state receive departure alerts.

### 2. Status Change and Cancellation Alerts
* Triggered immediately when:
  * A driver accepts or declines a booking request.
  * A rider cancels an accepted seat.
  * A driver cancels or reschedules the trip.
* The notification payload contains the updated trip state, formatted departure time, participant name, and route details.

### 3. Deduplication & Idempotency
To prevent spamming participants during network retries or concurrent webhook events:
* Every outgoing notification and incoming message enforces an `Idempotency-Key` header.
* Duplicate events within a 15-minute sliding window are deduplicated using unique event hashes (`trip_id + event_type + timestamp_bucket`).
* Participants can mark messages as read up to a specified message ID (`POST /api/mobility/trips/{trip}/messages/read` with `through_id`), ensuring unread badge counts stay accurate across multiple devices.

---

## 3. In-App Trip Messaging & Safety Controls

Handled by `STS\Mobility\Communications\TripCommunicationController`:
* **Scoped Access**: Only the driver and confirmed (accepted) riders can access the trip message thread.
* **Privacy Guardrail**: Precise GPS coordinates and personal phone numbers are excluded from message payloads; communication remains within the app.
* **Participant Blocking**: Participants can block abusive users (`POST /api/mobility/trips/{trip}/block`), which immediately suspends bidirectional messaging and triggers safety flags.

---

## 4. API Endpoints

Registered in `routes/mobility.php`:
* `GET /api/mobility/notifications` — Retrieve pending and historical notification alerts for the authenticated user.
* `GET /api/mobility/trips/{trip}/messages` — Read trip conversation messages with pagination (`after` / `before`).
* `POST /api/mobility/trips/{trip}/messages` — Send a message to the trip chat with `Idempotency-Key`.
* `POST /api/mobility/trips/{trip}/messages/read` — Acknowledge messages read through `through_id`.
* `POST /api/mobility/trips/{trip}/block` — Block or unblock a participant on safety grounds.

---

## 5. Verification & Automated Test Evidence

Automated test suite:
* **File**: `backend/extensions/carpoolear/tests/MobilityTripCommunicationHttpTest.php`
* **Test cases verified**:
  * `test_driver_and_accepted_rider_can_read_and_send_canonical_chat_without_precise_coordinates`: Verifies chat visibility for accepted riders, hiding precise coordinates for privacy.
  * `test_unaccepted_riders_cannot_send_messages`: Rejects unaccepted/pending users from sending messages.
  * `test_message_idempotency_prevents_duplicate_deliveries`: Validates idempotency key deduplication.
  * `test_read_receipts_and_unread_counts`: Confirms read-through message tracking.
  * `test_participant_blocking_halts_communications`: Verifies block action stops messaging immediately.

All tests execute and pass cleanly within the test suite.
