# Implementation plan

1. Implement validated pending transaction storage and idempotent recovery.
2. Wire commit/recovery under existing task locks and add status/event recovery.
3. Allocate collision-free completion artifacts from persistent ledger history.
4. Audit rollback events and reload safe points inside locks.
5. Add failure injection and rollback immutability regressions; build and run completion/rollback suites.

## Verification gate

Inject ledger append and task state failures, then retry and verify exactly one transition/event. Recovery rejects divergent task changes. Rollback then recomplete preserves old snapshot bytes and uses a new path. A partial pre-journal artifact failure cannot overwrite prior evidence. Existing rollback/completion tests pass.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
