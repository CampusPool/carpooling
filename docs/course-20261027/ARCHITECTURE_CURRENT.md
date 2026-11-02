# MobilityPlatform architecture — current engineering draft

This document describes the current local implementation boundary. It is a draft for review, not an approved SAD or deployment design.

```text
Next.js client
    | authenticated API/rewrite
Laravel mobility extension and canonical trip authority
    | transactions, locks, constraints and lifecycle events
MySQL authority ------------------> Mongo activity projection
    |
route/map adapters (local or external provider)
```

MySQL owns users, vehicles, offers, bookings, trip lifecycle and synthetic financial state. The Mongo process reads an allow-list of lifecycle fields from a read-only SQL snapshot and upserts activity documents keyed by source event identity. Mongo never decides capacity, booking admission or payment authority.

Booking and capacity mutations use authorization, row locks, unique constraints, stale-state guards and idempotency keys. Route and pickup proposals are immutable and rechecked before admission. The client does not write trusted geometry or financial authority directly.

The supported evidence environment is loopback-only Laravel/MySQL plus the local Next.js client and isolated projection checks. Secrets, tokens, identity documents, provider keys and pilot database exports are excluded from tracked evidence. Real email, live payment, physical GPS, OS push and public deployment are outside the current evidence.
