# Critical invariants evaluation patch

Candidate hardening for pinned Carpoolear `6ba3d8913a8f77e664e848a526f196690a03c1e8`; vendor checkout is untouched. Intended changes: MySQL trip-row locking inside the existing repository `newRequest` and `acceptRequest` methods, owner-or-self cancellation, and public HTTP registration stripping of server-owned identity/admin/activation fields. Sanitization is scoped to `UserController::create` so trusted social/system `UsersManager::create` callers retain their internal activation behavior. Auto-accept now sets the returned result to the accepted row on success; when a locked acceptance finds no capacity it preserves the inserted pending row and emits the normal request event. Optional seat-payment mode remains unchanged and no provider payments are fabricated.

The root HTTP probe observed accepted-passenger cancellation by an unrelated actor, overselling of one seat in sampled concurrent races, duplicate active-request rows, and public registration accepting verification flags. Apply this candidate in a disposable checkout, run focused checks, then repeat the real HTTP probe. The `WAITING_PAYMENT -> pay` path remains outside the locked `acceptRequest` path and is explicitly unfixed/unverified. No full suite or container launch is requested.

Apply/check/revert:

```sh
cd <repository-root>
git apply --check --directory=research/vendor/carpoolear_backend research/experiments/carpoolear/patches/critical-invariants.patch
git apply --directory=research/vendor/carpoolear_backend research/experiments/carpoolear/patches/critical-invariants.patch
git apply -R --directory=research/vendor/carpoolear_backend research/experiments/carpoolear/patches/critical-invariants.patch
```
