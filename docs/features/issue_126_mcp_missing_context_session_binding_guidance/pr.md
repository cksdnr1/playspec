# PR Body

Fixes #126

## Summary

- Updated `McpTaskContextRequiredError` so missing MCP task context now guides callers to provide `taskId` directly or bind a reusable session with `playspec_use_session_task` before passing `sessionId`.
- Added resolver-level coverage for the improved hint.
- Added MCP tool-handler coverage proving missing-context responses surface `playspec_use_session_task`.

## Changed files

- `src/mcp/errors.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/spec.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/plan.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/result.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/pr.md`

## Tests run

- `pnpm install`
- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `git diff --check`

Skipped:

- Full `pnpm test`, because this change is limited to MCP diagnostics and the targeted MCP integration suite plus build passed.

## PlaySpec task id

`issue_126_mcp_missing_context_session_binding_guidance`

## Risk notes

Low risk. This is a diagnostic-only change. MCP context resolution still requires explicit `taskId` or `sessionId` and does not fall back to `.playspec/HEAD`.

## Reusable agent guidance

No reusable AGENTS.md guidance change is needed. The existing repository rule already states that MCP context resolution must use `resolveMcpTaskId()` and must never read `.playspec/HEAD`; this PR preserves that contract.
