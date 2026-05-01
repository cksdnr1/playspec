# Draft PR: PlaySpec Update 5.1

Fixes #47

## Summary

- Added archived task listing and inspection through `playspec archive list` and `playspec archive show --task <taskId>`.
- Added `TaskStore.listArchivedTasks()` and `YamlTaskStore.listArchivedTasks()` using `.playspec/tasks/archived/{taskId}/task.yaml` as source of truth.
- Added regression coverage for archived listing isolation and explicit archived artifact `contextRefs` in active prompt rendering.
- Preserved Phase 5.1 boundaries: no restore/unarchive, no MCP archive lookup, no automatic archived context inclusion, and no evolution proposal behavior.

## Changed files

- `src/cli/commands/archive.ts`
- `src/cli/index.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/task-store.test.ts`
- `docs/features/playspec_update_5_1/spec.md`
- `docs/features/playspec_update_5_1/spec_validation.md`
- `docs/features/playspec_update_5_1/plan.md`
- `docs/features/playspec_update_5_1/plan_validation.md`
- `docs/features/playspec_update_5_1/result.md`
- `docs/features/playspec_update_5_1/pr.md`

## Tests run

Passed:
- `pnpm build`
- `pnpm test -- --run tests/integration/task-store.test.ts`
- `pnpm test -- --run tests/integration/init-create-next.test.ts -t "lists and shows archived tasks"`
- `pnpm test -- --run tests/cli.test.ts -t "archived artifact context"`
- `pnpm test -- --run tests/integration/mcp-server.test.ts`

Additional build-validator pass:
- `pnpm exec tsc --noEmit`

Attempted but not counted as passing:
- `pnpm test -- --run tests/integration/task-store.test.ts tests/integration/init-create-next.test.ts tests/cli.test.ts` hung in unrelated existing full-file CLI subprocess cases.
- `pnpm test` hung/timed out in unrelated integration suites during build-validator verification.

## PlaySpec task id

`playspec_update_5_1`

## Risk notes

- Full-suite confidence is limited by existing Vitest subprocess hangs; focused Phase 5.1 tests and build checks pass.
- Archive inspection is read-only. Restore/unarchive and MCP archive lookup remain intentionally absent.
- Existing context validation accepts existing workspace-relative files, so archived artifact refs work through explicit paths without adding archive-specific prompt auto-inclusion.
