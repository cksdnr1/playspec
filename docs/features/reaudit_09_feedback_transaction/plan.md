# Implementation plan

1. Extract reusable feedback capture with mutation-free preflight.
2. Journal capture request and stable observation identity.
3. Recover capture, persist outcome, append ledger and transition task exactly once.
4. Add pre-journal/post-feedback failure injections and compaction dedupe regression; build and completion/evolution/MCP tests.

## Acceptance gate
Inject prepare failure and verify zero feedback observations, then retry gives one completion/one observation. Inject failure after thread write but before resolved journal/ledger and verify recovery does not duplicate. Existing ledger/task/cleanup recovery and failure-policy tests pass; compaction retains idempotency.

Revisit the design if failure injection exposes an inconsistent contract.
