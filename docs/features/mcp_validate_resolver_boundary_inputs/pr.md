# Draft PR

Fixes #106

## Summary

- Add shared MCP identifier validation for task IDs and session IDs.
- Validate resolver inputs before session lookup while preserving explicit valid `taskId` precedence over `sessionId`.
- Validate `McpSessionStore.setSessionTask()` inputs before session YAML load/save work.
- Expand MCP error hints to document non-empty, filename-safe identifier rules.
- Add integration coverage for empty-string sessions, malformed session IDs, colon-containing task IDs, and session binding validation.

## Changed Files

- `src/mcp/validation.ts`
- `src/mcp/context.ts`
- `src/mcp/errors.ts`
- `src/mcp/session-store.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_validate_resolver_boundary_inputs/spec.md`
- `docs/features/mcp_validate_resolver_boundary_inputs/plan.md`
- `docs/features/mcp_validate_resolver_boundary_inputs/result.md`
- `docs/features/mcp_validate_resolver_boundary_inputs/pr.md`

## Tests Run

- `pnpm test tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm test tests/integration/mcp-server.test.ts` (rerun after final test-name cleanup)

## PlaySpec Task

- `mcp_validate_resolver_boundary_inputs`

## Risk Notes

- `loadSession()` and `saveSession()` remain lower-level helpers without additional validation; the MCP resolver and session binding write path are guarded, matching the issue scope.
- Direct MCP `taskId` values with colons now reject early. This is stricter than previous behavior and aligns with filename-safe identifier rules.

## Reusable Agent Guidance

No reusable agent guidance is needed. This change is a narrow MCP boundary validation fix and does not introduce a new repeatable workflow pattern.
