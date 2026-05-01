# Issue 45 - Phase 5 Archive Storage And Close Implementation Plan

## Ordered Steps

1. Add archive path helpers in `src/utils/paths.ts`.
   - Add active-root names for clarity.
   - Keep `getTasksRoot()` and `getTaskRoot()` as active aliases so existing callers remain unchanged.
   - Add `getArchivedTasksRoot()` and `getArchivedTaskRoot()`.

2. Extend the storage interface in `src/storage/task-store.ts`.
   - Add `getArchivedTask(taskId): Promise<TaskRecord>`.
   - Add `archiveCompletedTask(taskId): Promise<TaskRecord>`.

3. Implement archived storage in `src/storage/yaml-task-store.ts`.
   - Read active task YAML from active root only.
   - Read archived task YAML from archived root only.
   - Preflight archive mutation: active task exists, status is `completed`, source directory exists, destination directory does not exist.
   - Move active directory to archived directory.
   - Rewrite archived `task.yaml` with `status: archived`, updated `updatedAt`, and archived `paths.taskRoot`.
   - Return `TaskRecordSchema`-validated archived record.

4. Add the core API in `src/core/playspec-core.ts`.
   - Add `closeTask(taskId)` that calls `taskStore.archiveCompletedTask(taskId)`.
   - Do not add CLI-specific behavior to core.

5. Add the CLI command adapter.
   - Create `src/cli/commands/close.ts`.
   - Require `--task <id>` to avoid implicit HEAD closure.
   - Print concise success output with task ID and archived root.
   - Register only `playspec close --task <id>` in `src/cli/index.ts`.
   - Do not add `archive list`, `archive show`, or archive command groups.

6. Add focused tests.
   - `tests/integration/task-store.test.ts`: archive completed task, reject active task, reject collision, active `getTask()` does not read archived tasks, `getArchivedTask()` reads archived tasks.
   - `tests/integration/init-create-next.test.ts`: CLI `close --task` succeeds for completed task; no archive list/show CLI surface is registered.
   - `tests/integration/mcp-server.test.ts`: server object does not register archive lookup/list tools.
   - Existing prompt/context tests remain unchanged and are included in focused validation.

7. Validate.
   - Run focused tests for task storage, CLI close, MCP regression, and prompt/context regression.
   - Run `pnpm build`.
   - Run full `pnpm test` if focused validation and build pass.

## Files To Edit

- `src/utils/paths.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/close.ts`
- `src/cli/index.ts`
- `tests/integration/task-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/result.md`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/pr.md`

## Risks

- Directory move happens before archived `task.yaml` rewrite. Preflight all known failure conditions first and keep the mutation as narrow as possible.
- `HEAD` may reference a closed task. This phase does not define HEAD cleanup, and active lookups should fail through existing active-only semantics.
- Archive list/show and archive-aware context are Phase 5.1. Avoid any command shape that implies those are available.

## Rollback Notes

- Before commit, normal Git checkout/revert of this branch restores code changes.
- Runtime archived task moves are explicit user operations under `.playspec/tasks/archived/{taskId}`. This phase intentionally does not implement restore.

## Completion Criteria

- Completed active task can be closed through `playspec close --task <taskId>`.
- Active task directory is moved to `.playspec/tasks/archived/{taskId}`.
- Archived `task.yaml` validates with `TaskRecordSchema`.
- Active lookup remains active-only.
- Archive destination collision and non-completed task close are rejected.
- No archive list/show CLI and no MCP archive lookup tool are introduced.
- Focused tests, build, and available full tests pass or failures are reported exactly.
