# PR Draft

Fixes #105

## Summary

- Add `McpSessionNotFoundError` for MCP session IDs that cannot be loaded.
- Split `resolveMcpTaskId()` session handling so missing sessions and existing null-task sessions produce distinct errors.
- Update MCP integration coverage for missing-session, null-task, and missing-session hint behavior.

## Changed Files

- `src/mcp/errors.ts`
- `src/mcp/context.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/spec.md`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/plan.md`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/result.md`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm test -- tests/integration/mcp-server.test.ts`

## PlaySpec Task

- `mcp_differentiate_session_not_found_from_session_has_no_task`

## Risk Notes

- `McpSessionStore.loadSession()` still returns `null` for any load failure, so corrupt or unreadable session files will also surface as `McpSessionNotFoundError`.
- Downstream callers that caught only `McpSessionContextEmptyError` for missing sessions may need to handle `McpSessionNotFoundError`.

## Reusable Agent Guidance

- No reusable agent guidance is needed. The change is issue-specific and does not alter general workflow rules.
