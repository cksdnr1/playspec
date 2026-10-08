# Serialize and deduplicate phase completion

## Problem

Two concurrent completePhase calls both validate the same stale phase outside the task lock and append duplicate completion history. CLI callers do not pass the existing expected-phase guard.

## Contract and implementation

Acquire the canonical task-ID write lock before loading or validating completion state. Serialize context/link/current-phase mutations through the same lock. Add optional requestId persisted with completion events: repeated identical requests replay their recorded transition without advancing again, including final completed tasks; conflicting reuse rejects. CLI exposes expected-phase and request-id, and always passes the phase it resolved before completing; MCP exposes requestId alongside expectedPhaseId. Existing callers without IDs remain compatible but cannot obtain retry deduplication.

## Acceptance and regression coverage

Concurrent callers with identical expectedPhaseId yield one success and one stale-phase error; duplicate requestId yields one event and one transition. Retry a final completion safely; reject a request ID reused for a different result/phase. Existing CLI/MCP/routing behavior remains compatible.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
