# Implementation plan

1. Extract task mutation lock with pending completion recovery.
2. Route Core locking and structured migration actions through it.
3. Recheck active target inside mutation lock.
4. Add deterministic concurrency and recovery tests; build and migration/completion regressions.

## Acceptance gate
Hold the migration backup while a completion is queued and verify both title and phase history survive. Apply a migration after a pending completion write failure and verify recovery precedes title change. Existing unsafe path and deterministic promotion tests must pass.

Revisit the design if failure injection exposes an inconsistent contract.
