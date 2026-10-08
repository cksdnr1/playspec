# Require guarded idempotent MCP completion requests

## Observed failure
MCP completion accepts requests without expected phase or idempotency key, so concurrent stale invocations can advance successive phases.

## Contract
Require nonempty expectedPhaseId and requestId at the MCP schema and handler boundary. Same-key retries replay recorded completion; distinct stale requests fail after one transition. Keep Core and CLI optional-guard compatibility. Expose required guarded-call guidance to MCP callers.

## Verification
Schema and direct handler reject missing guards without mutations. Parallel requests for one expected phase advance once; replaying the same request returns the same event. Existing MCP delegation and feedback tests keep valid explicit guards.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
