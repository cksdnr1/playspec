# MCP taskId Resolver Boundary Validation Plan

## Ordered Implementation Steps

1. Add an MCP-specific invalid task ID error.
   - Edit `src/mcp/errors.ts`.
   - Add `McpInvalidTaskIdError extends PlaySpecError`.
   - Message should identify invalid MCP `taskId`.
   - Hint should document allowed boundary rules: no `/`, no `\`, no null bytes, no control characters, maximum 256 characters.

2. Validate explicit MCP `taskId` before returning it.
   - Edit `src/mcp/context.ts`.
   - Import `McpInvalidTaskIdError`.
   - Add a small local helper such as `assertValidMcpTaskId(taskId: string): void`.
   - In `resolveMcpTaskId()`, call the helper inside the `if (input.taskId)` branch before returning.
   - Keep current `taskId` over `sessionId` precedence.
   - Keep session lookup and no-context behavior unchanged.

3. Add focused regression tests.
   - Edit `tests/integration/mcp-server.test.ts`.
   - Import `McpInvalidTaskIdError`.
   - Add tests in the existing `resolveMcpTaskId` describe block for:
     - slash path separator rejection,
     - backslash path separator rejection,
     - null byte rejection,
     - ASCII control character rejection,
     - over-256-character rejection,
     - error hint documents the validation rules.
   - Preserve existing valid direct task ID, session, and precedence tests.

## Files to Edit

- `src/mcp/errors.ts`
- `src/mcp/context.ts`
- `tests/integration/mcp-server.test.ts`

## Tests to Run

- `pnpm install`
- `pnpm build`
- `pnpm test`

Targeted test during iteration:

- `pnpm test -- tests/integration/mcp-server.test.ts`

## Active Entry Point Chain

MCP tool args -> `resolveMcpTaskId()` -> direct task ID validation -> core API call or task store call.

The implementation closes the direct task ID bypass before downstream `.playspec` path construction can see malformed path-like values. No state update, persistence, reset, or clear behavior is added by this feature.

## Old Paths, Bypasses, and Partial Migration Risks

- Old path: explicit `taskId` returned raw from `resolveMcpTaskId()`. This must be replaced by validate-then-return.
- Bypass path: direct `taskId` still bypasses `TaskIdResolver.resolve()` by design, but no longer bypasses boundary validation.
- Session path: `sessionId` resolution remains unchanged and is out of scope.
- MCP schemas: unchanged; resolver remains the validation boundary.

## Risks

- Some manually created task IDs with path separators or control characters will now be rejected through MCP direct task context. This is intended for boundary safety.
- Session-stored task IDs are not validated on read in this issue. That remains a separate concern if needed.

## Rollback Notes

Rollback is a simple revert of the three edited files. No migrations, persistent schema changes, or task data rewrites are involved.

## Completion Criteria

- Invalid direct MCP `taskId` values fail with `McpInvalidTaskIdError`.
- Error hint documents forbidden separators, null/control characters, and max length.
- Valid direct task IDs still resolve unchanged.
- Existing session and no-HEAD fallback behavior remains unchanged.
- Build and test suite pass.
