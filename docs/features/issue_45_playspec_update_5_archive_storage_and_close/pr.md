Fixes #45

## Summary

- Added canonical archived task storage under `.playspec/tasks/archived/{taskId}/`.
- Added explicit storage/core archive APIs and a narrow `playspec close --task <taskId>` CLI path for completed tasks.
- Preserved active-only task lookup and avoided Phase 5.1 behavior such as archive list/show, restore, MCP archive lookup, and archive-aware context refs.
- Added focused integration coverage for archive movement, rejection cases, active lookup isolation, CLI surface, MCP non-expansion, and prompt/context regressions.

## Changed Files

- `src/utils/paths.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/errors.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/close.ts`
- `src/cli/index.ts`
- `tests/integration/task-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/spec.md`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/plan.md`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/result.md`
- `docs/features/issue_45_playspec_update_5_archive_storage_and_close/pr.md`

## Tests Run

- `pnpm build`
- `pnpm test -- --run tests/integration/task-store.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`

Attempted:

- `pnpm test`
- `PLAY_SPEC_DISABLE_CLIPBOARD=1 pnpm test`

The full-suite attempts did not complete in this environment because the broad CLI test process did not exit after visible suites completed; focused Phase 5 tests and build passed.

## PlaySpec Task

- `issue_45_playspec_update_5_archive_storage_and_close`

## Risk Notes

- Closing a task does not clear `.playspec/HEAD`; Phase 5 does not define HEAD cleanup.
- If the archived `task.yaml` rewrite fails after directory rename, task files have already moved. The implementation preflights status and archive destination collision before mutation.
