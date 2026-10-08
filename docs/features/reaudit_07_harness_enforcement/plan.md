# Implementation plan

1. Check current harness within completePhaseLocked.
2. Move attempt/reset reads inside shared task mutation lock.
3. Reject noncurrent attempt phase.
4. Add blocking/reset/wrong-phase tests and run existing Core/MCP harness cases; build.

## Acceptance gate
Three failures block completion without ledger/history/snapshot writes; reset restores completion; recording another phase cannot erase the block. Concurrent phase movement cannot cause a stale harness write. Existing reset and per-phase state regressions pass.

Revisit the design if failure injection exposes an inconsistent contract.
