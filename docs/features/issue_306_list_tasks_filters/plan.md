# Issue 306 List Tasks Filters Implementation Plan

## Ordered Implementation Steps

1. Update `playspec_list_tasks` argument schema in `src/mcp/server.ts`.
   - Add `status`, `phase`, `slug`, `idContains`, `summary`, `detail`, `limit`, and `offset`.
   - Use Zod validation with bounded integer pagination.
   - Keep `workspaceRoot` behavior unchanged.

2. Add MCP-local list helpers in `src/mcp/server.ts`.
   - Define default/max limits.
   - Normalize `summary: false` to detail mode.
   - Load only requested status groups.
   - Filter summaries by phase, slug, and id substring.
   - Paginate after filtering across the combined list.
   - Regroup paginated results as `active`, `completed`, and optionally `archived`.

3. Add optional detail expansion.
   - For active/completed summaries, call `YamlTaskStore.getTask(id)`.
   - For archived summaries, call `YamlTaskStore.getArchivedTask(id)`.
   - Fetch details only after filtering and pagination.
   - Keep default output summary-shaped.

4. Add pagination metadata.
   - Return `pagination: { limit, offset, total, returned, hasMore }`.
   - Preserve `diagnostics`.
   - Preserve existing `active` and `completed` top-level keys.
   - Include `archived` when requested by `status: "archived"` or `status: "all"`.

5. Extend `tests/integration/mcp-server.test.ts`.
   - Test default bounded summary behavior with more tasks than the default limit.
   - Test `status + phase` filtering.
   - Test `slug` and `idContains` matching.
   - Test `detail: true` returns full record fields and default does not.
   - Test archived listing when requested.

6. Run validation.
   - `pnpm test -- tests/integration/mcp-server.test.ts`
   - `pnpm test`
   - `pnpm build`

## Files To Edit

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_306_list_tasks_filters/result.md`
- `docs/features/issue_306_list_tasks_filters/pr.md`

## Tests To Add Or Update

- Add tests near existing `playspec_list_tasks` coverage.
- Reuse `PresetManager`, `YamlTaskStore`, and `initWorkspaceWithTask`.
- Create multiple tasks directly through `YamlTaskStore.createTask()` for fast pagination/filter tests.
- Use `archiveCompletedTask()` to verify archived summaries are opt-in.

## User-Visible Behavior Chain

1. MCP caller invokes `playspec_list_tasks` with optional filters.
2. Zod validates arguments.
3. Handler resolves workspace root and reads summaries from `YamlTaskStore`.
4. Handler filters and paginates summaries.
5. Handler optionally fetches full records for the visible page.
6. Handler returns grouped arrays plus pagination metadata and diagnostics.
7. Caller can locate a task id without dumping a huge response.

## Old Paths, Bypasses, And Partial Migration Risks

- `playspec_get_task` remains the full-record lookup by id.
- `playspec_get_status` remains the cheap known-task status path.
- CLI `playspec list-tasks` remains unchanged.
- Existing callers that read `active`/`completed` still get those keys.
- Existing callers needing all tasks must request pages or an explicit larger limit.

## Risks

- Default limiting may surprise callers expecting all tasks. Mitigation: explicit `pagination.hasMore` and `limit`.
- Detail mode could become expensive on large workspaces. Mitigation: detail fetch happens after filters and pagination.
- Archived task listing expands behavior. Mitigation: only include archived output when explicitly requested.

## Rollback Notes

- Revert the MCP handler changes and related tests.
- No migration, persisted schema, or task data changes are required.

## Completion Criteria

- Default `playspec_list_tasks` response is summary-shaped and bounded.
- Filtering by `status + phase`, `slug`, and `idContains` works in MCP tests.
- `detail: true` or `summary: false` returns full records for the visible page.
- Archived tasks can be listed when explicitly requested.
- Relevant tests and build pass.
