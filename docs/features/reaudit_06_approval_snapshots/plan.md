# Implementation plan

Extend gate validation capture; persist snapshots and metadata; enforce freshness at commit and downstream consumption; add focused regressions.

## Acceptance gate
Inject artifact edits during evidence collection and reject completion. Verify immutable snapshots retain original bytes. Reject later execution with changed approved inputs and reject tampered snapshots.

Revisit the design if failure injection exposes an inconsistent contract.
