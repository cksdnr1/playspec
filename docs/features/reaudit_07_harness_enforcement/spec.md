# Enforce blocked harness state before phase execution

## Observed failure
Three failed harness attempts set blocked/circuitBreaker, but completePhase still advances. An attempt for a different phase can also replace the current phase record.

## Contract
Check the current phase harness inside the shared completion lock before artifacts, feedback or state writes. Block completion while blocked/circuitBreaker is true. Attempt and reset mutations load fresh task state under the same mutation lock with pending completion recovery; reject attempts for a noncurrent phase to avoid overwriting its record. Explicit reset remains the documented human-review recovery route. Read-only prompt/status inspection remains available.

## Verification
Three failures block completion without ledger/history/snapshot writes; reset restores completion; recording another phase cannot erase the block. Concurrent phase movement cannot cause a stale harness write. Existing reset and per-phase state regressions pass.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
