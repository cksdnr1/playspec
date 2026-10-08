# Implementation plan

1. Wrap completion and task context/link/phase mutation in a shared task-ID lock.
2. Persist and replay requestId with conflict checks.
3. Wire CLI and MCP options and add concurrency/retry regressions; build and run core/routing/MCP suites.

## Verification gate

Concurrent callers with identical expectedPhaseId yield one success and one stale-phase error; duplicate requestId yields one event and one transition. Retry a final completion safely; reject a request ID reused for a different result/phase. Existing CLI/MCP/routing behavior remains compatible.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
