# Issue 306 Implementation Result

## Behavior Implemented

- `playspec_list_tasks` now accepts `status`, `phase`, `slug`, `idContains`, `summary`, `detail`, `limit`, and `offset`.
- Default output remains compact summary-shaped and is bounded to 50 tasks.
- Pagination metadata reports `limit`, `offset`, `total`, `returned`, and `hasMore`.
- `status: "archived"` and `status: "all"` can include archived tasks.
- `detail: true` and `summary: false` return full task records for the filtered/paginated page.
- Existing `active` and `completed` response keys are preserved.

## Files Changed

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_306_list_tasks_filters/spec.md`
- `docs/features/issue_306_list_tasks_filters/plan.md`
- `docs/features/issue_306_list_tasks_filters/result.md`

## Verification

- `pnpm test -- tests/integration/mcp-server.test.ts` passed: 86 tests.
- `pnpm test` passed: 699 tests.
- `pnpm build` passed.

## Remaining Risks

- Existing MCP callers that assumed an unbounded default list must follow `pagination.hasMore` or pass an explicit `limit`.
- Full detail mode can still be expensive with high limits, but details are fetched only after filtering and pagination.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied; the implementation is already localized to the MCP handler and focused integration tests.
- Skipped broader extraction into storage/core because the behavior is MCP response shaping and should not affect CLI or Core boundaries.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/309
- Reusable agent guidance: no new reusable guidance needed; the existing MCP/Core boundary rules were sufficient.
