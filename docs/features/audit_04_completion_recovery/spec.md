# Recover completion writes and preserve immutable evidence

## Problem

Completion ledger writes precede task state without a recovery record. A state-write failure leaves a successful event without its transition; retry and rollback can overwrite snapshots referenced by old events.

## Contract and implementation

Persist a versioned pending completion transaction containing the before-task, validated transition input, immutable event and markdown after evidence creation and before ledger/state commit. Recover idempotently under the task lock on subsequent mutations and status/event reads: finish only when state matches the before snapshot or the already-applied transition; reject conflicts. Retain the pending record on failure and clear it only after both stores agree. Use ledger-based per-phase visit suffixes across rollback/rewind and unique attempt suffixes if an orphan artifact already occupies a path. Rollback leaves append-only completion events and records a separate rollback audit file; refresh the task/safe point inside its lock. Existing first-completion filenames remain compatible.

## Acceptance and regression coverage

Inject ledger append and task state failures, then retry and verify exactly one transition/event. Recovery rejects divergent task changes. Rollback then recomplete preserves old snapshot bytes and uses a new path. A partial pre-journal artifact failure cannot overwrite prior evidence. Existing rollback/completion tests pass.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
