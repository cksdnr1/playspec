# Commit feedback observations exactly once with completion

## Observed failure
Feedback is written before completion journal preparation. Retrying one request after a pre-journal failure counts its observation twice, even though completion is recorded once.

## Contract
Prepare a durable completion journal before any feedback thread mutation. Persist the feedback capture request in that journal and finish capture during transaction recovery. Give each committed observation a stable task/completion ID and deduplicate it under the thread lock, retaining IDs through event compaction. Save the resolved feedback outcome back into the journal before ledger/state writes. Extraction-only preflight preserves fail_completion rejection before mutation. Existing journals without feedback requests remain recoverable.

## Verification
Inject prepare failure and verify zero feedback observations, then retry gives one completion/one observation. Inject failure after thread write but before resolved journal/ledger and verify recovery does not duplicate. Existing ledger/task/cleanup recovery and failure-policy tests pass; compaction retains idempotency.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
