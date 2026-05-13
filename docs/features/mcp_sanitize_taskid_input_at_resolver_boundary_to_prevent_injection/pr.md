# PR Draft

Fixes #111

## Summary

Adds resolver-boundary validation for direct MCP `taskId` inputs before they are returned from `resolveMcpTaskId()` and passed to core/task-store operations.

The new validation rejects path separators, null/control characters, and task IDs longer than 256 characters. Invalid direct task IDs now produce an MCP-specific error with a hint documenting the rules. Existing session resolution, explicit task-over-session precedence, and no-HEAD-fallback behavior remain unchanged.

## Changed Files

- `src/mcp/context.ts`
- `src/mcp/errors.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/spec.md`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/plan.md`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/result.md`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection`

## Risk Notes

- Session-stored `currentTaskId` values are not revalidated on read; that remains out of scope for this issue.
- The error message intentionally avoids echoing the invalid raw task ID so null/control characters do not make diagnostics confusing.
