MCP completion accepts requests without expected phase or idempotency key, so concurrent stale invocations can advance successive phases.

Require nonempty expectedPhaseId and requestId at the MCP schema and handler boundary. Same-key retries replay recorded completion; distinct stale requests fail after one transition. Keep Core and CLI optional-guard compatibility. Expose required guarded-call guidance to MCP callers.

Validation: Build passed. Final complete suite: 51 files, 778 tests passed. MCP has 89 passing tests including required schema/direct-handler guards, concurrent stale requests advancing once, and same-ID completion replay. Updated README and MCP evolution client examples.

Task: `reaudit_03_mcp_completion_guard`.
