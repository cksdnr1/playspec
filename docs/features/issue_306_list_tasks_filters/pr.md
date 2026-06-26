Fixes #306

## Summary

- Adds server-side filtering to `playspec_list_tasks` by status, phase, slug/title substring, and id substring.
- Bounds default list output to compact task summaries with pagination metadata.
- Adds explicit detail opt-in through `detail: true` or `summary: false`.
- Exposes archived task listing only when requested.

## Why This PR

Large workspaces can have enough PlaySpec tasks that unfiltered MCP task discovery overflows the token budget. Callers need a cheap way to discover a task id before using `playspec_get_status` or `playspec_get_task`.

## Problem

`playspec_list_tasks` only accepted `workspaceRoot` and returned all active and completed task summaries in one response. It could not narrow by phase or slug, could not page results, and did not provide an explicit full-record opt-in path.

## How It Was Fixed

- `src/mcp/server.ts`
  - Added typed args for `status`, `phase`, `slug`, `idContains`, `summary`, `detail`, `limit`, and `offset`.
  - Added bounded default pagination with `limit: 50` and a max limit of 500.
  - Filters summaries before pagination and returns `pagination` metadata.
  - Fetches full task records only after filtering/pagination when detail mode is requested.
  - Includes archived tasks only for `status: "archived"` or `status: "all"`.
- `tests/integration/mcp-server.test.ts`
  - Added MCP integration coverage for bounded default output, status/phase filters, slug/id filters, detail opt-in, and archived opt-in.

## Validation

- `pnpm test -- tests/integration/mcp-server.test.ts` passed: 86 tests.
- `pnpm test` passed: 699 tests.
- `pnpm build` passed.
- Skipped: none.

## Changed Files

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_306_list_tasks_filters/spec.md`
- `docs/features/issue_306_list_tasks_filters/plan.md`
- `docs/features/issue_306_list_tasks_filters/result.md`
- `docs/features/issue_306_list_tasks_filters/pr.md`

## PlaySpec Task

- `issue_306_list_tasks_filters`

## Risks / Follow-ups

- Existing MCP callers that expected an unbounded default list must follow `pagination.hasMore` or request a larger explicit `limit`.
- Detail mode can be more expensive, but full records are fetched only for the filtered/paginated page.
