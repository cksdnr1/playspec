# Implementation Result

## Files Changed

- `src/mcp/errors.ts`
- `src/mcp/context.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/spec.md`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/plan.md`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/result.md`

## Behavior Implemented

- Added `McpSessionNotFoundError` for MCP session lookups where `McpSessionStore.loadSession()` returns `null`.
- Updated `resolveMcpTaskId()` so missing sessions and existing sessions with `currentTaskId: null` are handled by separate guards.
- Preserved `McpSessionContextEmptyError` for existing sessions with no current task.
- Preserved explicit `taskId` precedence and no-HEAD MCP context behavior.
- Added resolver coverage for the new missing-session error class and its create-and-bind hint.

## Verification Performed

- `pnpm install`
- `pnpm test -- tests/integration/mcp-server.test.ts`
  - 25 tests passed.
- `pnpm build`
- `pnpm test`
  - 24 test files passed.
  - 417 tests passed.

## Tests Changed

- `tests/integration/mcp-server.test.ts`
  - Missing session file now asserts `McpSessionNotFoundError`.
  - Existing session with `currentTaskId: null` continues to assert `McpSessionContextEmptyError`.
  - New hint assertion verifies the missing-session error instructs the caller to create and bind the session.

## Test Gaps

- No MCP server handler serialization test was added because handlers already share the resolver and no tool signature or server error path changed.

## Refactor Review

- Compared the scoped implementation diff against `origin/master`.
- No refactor was applied: the resolver guard split, new error class, and focused tests are already local and direct.
- Re-ran `pnpm test -- tests/integration/mcp-server.test.ts` after the refactor review.
  - 25 tests passed.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/110
- Reusable agent guidance: not needed; this issue did not reveal a reusable workflow rule beyond the existing MCP context-resolution constraints.

## Remaining Risks

- `McpSessionStore.loadSession()` still returns `null` for any read or parse failure, so corrupt or unreadable session files will also surface as `McpSessionNotFoundError`. This matches the issue's constraint to avoid changing the session store API.
- Downstream MCP callers that caught only `McpSessionContextEmptyError` for missing sessions may need to catch `McpSessionNotFoundError`.
