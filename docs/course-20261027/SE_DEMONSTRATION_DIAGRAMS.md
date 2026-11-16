# SE demonstration: use cases and flows

Working diagrams for the student preview. The [SE guidance review](COURSE_REVIEW_2026-11-14.md) calls for at least one use-case diagram and two sequence diagrams. These show intended interactions at a conceptual level; they are not evidence that an end-to-end flow has passed. Reconcile them with the revision and environment actually demonstrated. See the [functional](FUNCTIONAL_REQUIREMENTS.md) and [non-functional](NON_FUNCTIONAL_REQUIREMENTS.md) requirements.

## Use-case diagram

The same student may act as a rider or driver in different rides. External providers support the application; they are not university administrators.

```mermaid
flowchart LR
    Rider[Student rider]
    Driver[Student driver]
    Email[Email provider]
    Maps[Routing provider]
    subgraph CP[CampusPool system boundary]
        Login([Register, sign in and recover access])
        Profile([Manage profile and preferences])
        Publish([Publish a ride])
        Search([Search and review rides])
        Request([Request a seat])
        Decision([Accept or reject a request])
        Manage([Manage or cancel a booking])
        Chat([Communicate about a trip])
        Feedback([Rate a completed ride])
        Safety([Use supported safety controls])
    end
    Rider --- Login & Profile & Search & Request & Manage & Chat & Feedback & Safety
    Driver --- Login & Profile & Publish & Decision & Manage & Chat & Feedback & Safety
    Email --- Login
    Maps --- Publish & Search
```

## Sequence 1: driver publishes a ride

```mermaid
sequenceDiagram
    actor Driver
    participant App as Student app
    participant API as CampusPool API
    participant Route as Routing provider
    participant DB as MySQL
    Driver->>App: Enter places, departure and seats
    App->>Route: Select places and obtain route information
    Route-->>App: Route details or error
    alt Route available and details valid
        Driver->>App: Review and publish
        App->>API: Submit authenticated ride details
        API->>API: Authorize and validate request
        API->>DB: Persist offer
        DB-->>API: Saved offer
        API-->>App: Publication result
        App-->>Driver: Show ride or validation error
    else Provider unavailable or input invalid
        App-->>Driver: Show error and allow correction or retry
    end
```

## Sequence 2: rider requests and driver responds

```mermaid
sequenceDiagram
    actor Rider
    actor Driver
    participant App as Student app
    participant API as CampusPool API
    participant DB as MySQL
    Rider->>App: Search by places and departure time
    App->>API: Send authenticated search
    API->>DB: Find eligible offers
    DB-->>API: Candidate offers
    API-->>App: Matching results
    App-->>Rider: Show ride and pickup details
    Rider->>App: Request a seat
    App->>API: Submit request
    API->>DB: Validate and record request
    API-->>App: Pending request or error
    Driver->>App: Review and accept or reject request
    App->>API: Submit driver's decision
    API->>DB: Authorize and update booking and capacity
    DB-->>API: Result
    API-->>App: Updated status or error
    App-->>Rider: Show booking status
```

## Demonstration flow

```mermaid
flowchart TD
    A[Record revision and prepare test accounts] --> B[Driver signs in and reviews profile and vehicle]
    B --> C[Driver selects places and publishes a ride]
    C --> D[Rider signs in and searches a compatible route]
    D --> E{Matching ride found?}
    E -- No --> F[Show empty or provider error state and record result]
    E -- Yes --> G[Rider reviews ride and requests a seat]
    G --> H[Driver accepts or rejects]
    H --> I[Show both accounts' resulting status]
    I --> J[Demonstrate available cancellation and capacity update]
    J --> K[Record observed results and limitations]
```

Use only authorized test accounts and avoid exposing credentials or private locations. The two-person Ola journey remains an evidence item in the scope review; do not present this diagram as proof that it passed. Show demo wallet and vehicles as simulated. If an action fails or is unavailable, record the result instead of implying completion. The existing [runbook](DEMO_RUNBOOK.md) describes a separate disposable synthetic environment and should be labeled accordingly.
