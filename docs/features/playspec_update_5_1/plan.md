# PlaySpec Update 5.1 Implementation Plan

## Ordered Steps

1. Add archived listing to storage.
   - Edit `src/storage/task-store.ts`.
   - Add `listArchivedTasks(): Promise<TaskSummary[]>`.
   - Edit `src/storage/yaml-task-store.ts`.
   - Scan `getArchivedTasksRoot(workspaceRoot)`.
   - Load each entry through `getArchivedTask(entry)`.
   - Return only records with `status: archived`.
   - Skip unreadable entries consistently with `listActiveTasks()` and `listCompletedTasks()`.

2. Add archive CLI command adapter.
   - Create `src/cli/commands/archive.ts`.
   - Add `runArchiveList(workspaceRoot)`.
   - Add `runArchiveShow(workspaceRoot, taskId)`.
   - Use `YamlTaskStore` directly, matching existing command adapter style.
   - Keep output read-only: no restore/unarchive hints.

3. Register archive command group.
   - Edit `src/cli/index.ts`.
   - Import the archive command adapter functions.
   - Register `playspec archive list`.
   - Register `playspec archive show --task <taskId>`.
   - Do not register restore, unarchive, MCP archive commands, or archive-aware active lookup.

4. Update storage tests.
   - Edit `tests/integration/task-store.test.ts`.
   - Add coverage that archived tasks are listed after closing.
   - Add coverage that non-archived or unreadable active entries are not mixed into archived listing.

5. Update CLI integration tests.
   - Edit `tests/integration/init-create-next.test.ts`.
   - Replace Phase 5 deferred-command assertions with positive `archive list` and `archive show --task` assertions.
   - Add regression that `list`/`list-tasks` do not include archived tasks after close.

6. Add explicit archived context prompt tests.
   - Edit `tests/cli.test.ts` if the helpers there are the shortest path.
   - Create an archived task artifact through existing close flow or direct fixture setup.
   - Add that archived artifact path to an active task via `add-context`.
   - Verify `prompt --no-copy` renders successfully and reports the linked archived file.
   - Verify a missing archived context path fails with the existing missing-reference style.

7. Run focused validation.
   - `pnpm build`
   - `pnpm test -- --run tests/integration/task-store.test.ts tests/integration/init-create-next.test.ts tests/cli.test.ts`
   - If focused tests pass, run full `pnpm test` unless the existing suite hang reappears. Record exact result either way.

## Files To Edit

- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/commands/archive.ts`
- `src/cli/index.ts`
- `tests/integration/task-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_update_5_1/result.md`
- `docs/features/playspec_update_5_1/pr.md`

## Old Paths And Bypasses

- `getTask()` remains active-only.
- `ActiveTaskResolver` remains active-only and may still use HEAD for human CLI contexts.
- `playspec list` and `playspec list-tasks` remain active-only.
- MCP server tool registration remains unchanged.
- Migration-local `archive_file` remains separate.

## Risks

- Archive inspection must not imply restore/unarchive.
- Directory scanning must tolerate missing `.playspec/tasks/archived`.
- Tests should avoid relying on command order unless output sorting is explicitly added.
- Existing context validation is broad by design; tests should prove archived paths are accepted without adding unnecessary special-case logic.

## Rollback Notes

All code changes are additive except replacement of Phase 5 deferred CLI assertions. Reverting the new command registration and storage interface restores prior Phase 5 behavior.

## Completion Criteria

- `TaskStore.listArchivedTasks()` exists and is implemented by `YamlTaskStore`.
- `playspec archive list` lists archived task summaries only.
- `playspec archive show --task <taskId>` inspects an archived task record.
- Active listing and active lookup do not include archived tasks.
- Active prompt rendering succeeds with explicit archived artifact `contextRefs`.
- Missing archived context refs fail explicitly.
- No restore/unarchive, MCP archive lookup, automatic archive context inclusion, or evolution proposal behavior is introduced.
