A migration title promotion reads task.yaml before backup, then overwrites a concurrent completed phase with its stale full record. Ledger and task history diverge.

Introduce one shared task mutation lock that validates task ID and recovers pending completion before loading writable state. Core and every structured migration action use this same lock. Revalidate target activity and previousValue inside the lock; read-modify-write and backup stay inside. Raw document actions retain their existing policy. Per-action serialization does not imply whole-plan atomicity.

Validation: Build and 39 migration, lock, completion recovery and concurrency tests passed. A queued completion preserves both migration title and completed history; pending completion recovers before promotion.

Task: `reaudit_02_migration_lock`.
