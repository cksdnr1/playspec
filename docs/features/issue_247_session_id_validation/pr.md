# Draft PR: Issue #247 Session ID Validation

Fixes #247

## Summary

- Validate MCP session IDs inside `McpSessionStore.loadSession()` before session file path construction.
- Preserve valid missing-session reads for `playspec_get_session_task`.
- Add focused integration coverage for malformed session reads through both the store and registered MCP handler.

## Changed Files

- `src/mcp/session-store.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_247_session_id_validation/spec.md`
- `docs/features/issue_247_session_id_validation/plan.md`
- `docs/features/issue_247_session_id_validation/result.md`
- `docs/features/issue_247_session_id_validation/pr.md`

## Tests Run

- `pnpm test tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_247_session_id_validation`

## Risk Notes

- `loadSession()` now rejects malformed session IDs instead of returning `null`. This is intentional and aligns the read path with existing MCP session binding and task-context validation.
- Valid nonexistent sessions still return `{ session: null, task: null }` through `playspec_get_session_task`.

## Reusable Agent Guidance

- No reusable agent guidance update is needed. Existing AGENTS.md guidance already covers MCP context validation and avoiding global HEAD fallback.
