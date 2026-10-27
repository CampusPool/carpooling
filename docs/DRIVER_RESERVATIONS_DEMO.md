# Driver reservation admission

The demo derives driver obligations from canonical Trips, accepted Passengers, dispatch assignments and lifecycle. It has no separate mutable busy calendar or seat counter.

Scheduled acceptance holds its Trip lock, then attempts an exclusive driver-user NOWAIT lock before current eligibility, overlap and seat checks. Dispatch acceptance retains its request/offer/availability/quote lock order and takes the same driver fence before canonical creation. The factory also enforces it so a direct factory caller cannot omit the check. Contention produces a retryable conflict, rather than waiting through an owner/Trip lock inversion.

Accepted obligations are read with locking joins, including publication/quote metadata. They therefore use current committed state even when the transaction established an older repeatable-read snapshot. Candidate Trip is excluded so additional riders can share its seats. Empty publications and pending riders do not reserve the driver. Canonical accepted Passenger rows remain the seat authority.

For planned dated routes the interval is the immutable local departure plus complete server route duration. A configurable **demo allowance of 300 seconds on each side** is set by `MOBILITY_DRIVER_RESERVATION_BUFFER_SECONDS` (integer 0–3600). This is a conservative scheduling assumption, not an operating policy or tariff. Half-open windows allow exact adjacency after both allowances. Private dispatch uses the complete agreed driver path, including approach; its occupied rider leg alone is insufficient.

Active on-demand, in-progress and overdue accepted obligations remain blocking until their canonical lifecycle/cancellation is resolved. Estimated duration is not proof the driver became free. An already accepted legacy route without trustworthy immutable terms requires recovery instead of inventing its duration. Pausing a recurring program does not remove its accepted obligations; cancelling/skipping the actual occurrence releases only that canonical obligation.

Cohort HTTP and repository entry points reject new admission on unquoted legacy Trips. Existing accepted history and cancellation/recovery remain available. Runtime model observers remain a backstop; arbitrary raw SQL is outside that guarantee.

Replay of committed dispatch acceptance returns its original assignment before new overlap admission. A conflict that rolled back can retry with the same key. Blocking fences new admission but never prevents an accepted Trip from starting solely because a participant later set a safety block; catalogue and private dispatch start paths both preserve this rule.

## Evidence

The disposable combined suite covers overlapping scheduled obligations, empty publications, exact buffered adjacency, cancellation release, cross-mode admission in both directions, repeatable dispatch acceptance, private approach duration, overdue obligations, and closing the unquoted legacy bypass.

`sh scripts/verify-local-road-journey.sh reservations` uses controlled landmark catalog fixtures and the actual internal car graph. Two independent HTTP acceptance workers are observed waiting on held canonical rows before they race. At most one conflicting obligation may commit; the loser must see the committed winner and must recover after its cancellation. An additional probe establishes an older database snapshot before the competing commit. This verifies driver reservation behavior; it does not deliver arbitrary-endpoint scheduled publication, map discovery or phone acceptance.

The full private real-road flow remains `sh scripts/verify-local-road-journey.sh private`, which also runs the reservation probe after car/motorcycle private journeys. Never run these disposable stacks in parallel or reset the persistent pilot to obtain test evidence.
