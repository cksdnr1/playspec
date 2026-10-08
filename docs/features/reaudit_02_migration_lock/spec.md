# Serialize migration task mutations with completion

## Observed failure
A migration title promotion reads task.yaml before backup, then overwrites a concurrent completed phase with its stale full record. Ledger and task history diverge.

## Contract
Introduce one shared task mutation lock that validates task ID and recovers pending completion before loading writable state. Core and every structured migration action use this same lock. Revalidate target activity and previousValue inside the lock; read-modify-write and backup stay inside. Raw document actions retain their existing policy. Per-action serialization does not imply whole-plan atomicity.

## Verification
Hold the migration backup while a completion is queued and verify both title and phase history survive. Apply a migration after a pending completion write failure and verify recovery precedes title change. Existing unsafe path and deterministic promotion tests must pass.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
