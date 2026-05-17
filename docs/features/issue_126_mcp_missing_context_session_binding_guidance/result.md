# Issue #126 Implementation Result

## Changed Files

- `src/mcp/errors.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/spec.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/plan.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/result.md`

## Behavior Implemented

- `McpTaskContextRequiredError` still reports that MCP tools require `taskId` or `sessionId`.
- The error hint now tells callers to provide `taskId` directly or use `playspec_use_session_task` to bind a task to a session before passing `sessionId`.
- Resolver-level tests now assert the improved hint includes `taskId`, `sessionId`, and `playspec_use_session_task`.
- MCP tool-handler tests now assert missing-context output includes `playspec_use_session_task`.
- Existing no-HEAD fallback coverage remains in place.

## Verification

- `pnpm test -- tests/integration/mcp-server.test.ts` initially failed before running tests because the new worktree did not have `node_modules`.
- `pnpm install` installed dependencies from the existing lockfile.
- `pnpm test -- tests/integration/mcp-server.test.ts` passed: 35 tests.
- Focused test phase rerun of `pnpm test -- tests/integration/mcp-server.test.ts` passed: 35 tests.
- `pnpm build` passed.

## Skipped Validation

- Full `pnpm test` was skipped because the change is limited to MCP diagnostics and the targeted MCP integration suite plus build passed.

## Remaining Risks

- Low. This is a diagnostic-only change with no MCP routing, persistence, or state behavior changes.

## Safe Refactor Review

- `git diff --check` passed.
- No refactor was applied because the implementation diff is already limited to the error hint and focused test assertions.
- Cleanup outside the touched MCP diagnostic path was intentionally skipped.
