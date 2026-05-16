# MCP taskId Resolver Boundary Validation Result

## Files Changed

- `src/mcp/errors.ts`
- `src/mcp/context.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/spec.md`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/plan.md`
- `docs/features/mcp_sanitize_taskid_input_at_resolver_boundary_to_prevent_injection/result.md`

## Behavior Implemented

- Added `McpInvalidTaskIdError` with a hint documenting the direct MCP `taskId` rules.
- Added resolver-boundary validation before `resolveMcpTaskId()` returns explicit `taskId`.
- Direct `taskId` now rejects:
  - `/`
  - `\`
  - null bytes
  - ASCII control characters
  - strings longer than 256 characters
- Existing direct valid task ID, session resolution, task-over-session precedence, and no-HEAD-fallback behavior remain unchanged.

## Verification Performed

- `pnpm test -- tests/integration/mcp-server.test.ts`
  - Passed: 31 tests.
- `pnpm test -- tests/integration/mcp-server.test.ts`
  - Passed after safe refactor: 31 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 24 test files, 424 tests.

## Tests Changed

- Added direct `resolveMcpTaskId()` regression coverage in `tests/integration/mcp-server.test.ts` for slash, backslash, null byte, control character, and over-length direct `taskId` values.
- Added coverage that the invalid task ID hint documents the boundary validation rules.

## Remaining Risks

- Session-stored `currentTaskId` values are not revalidated on read. That is intentionally out of scope for this issue.
- No reusable agent guidance changes are needed; this was a narrow MCP resolver boundary fix.

## Refactor Notes

- Avoided echoing invalid raw `taskId` values in `McpInvalidTaskIdError` to keep diagnostics stable when input contains null bytes or control characters.
- Skipped broader extraction or shared validation helpers because this issue only changes the MCP resolver boundary.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/114
