# Issue 45 - Phase 5 Archive Storage And Close Result

## Behavior Implemented

- Added explicit archive storage helpers for `.playspec/tasks/archived/{taskId}/`.
- Added `TaskStore.getArchivedTask(taskId)` and `TaskStore.archiveCompletedTask(taskId)`.
- Implemented completed-task archive movement in `YamlTaskStore`.
- Added `PlaySpecCore.closeTask(taskId)`.
- Added `playspec close --task <taskId>` as the single Phase 5 CLI path.
- Preserved active-only task lookup for `getTask()`, active lists, prompt rendering, and MCP tools.
- Did not add archive list/show, restore, MCP archive lookup, archive-aware context refs, or later-phase behavior.

## Files Changed

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

## Verification

Passed:

- `pnpm test -- --run tests/integration/task-store.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
  - 46 tests passed.
- `pnpm build`

Attempted but did not complete:

- `pnpm test`
- `PLAY_SPEC_DISABLE_CLIPBOARD=1 pnpm test`

Both full-suite attempts executed all visible integration/unit files through `tests/integration/runtime-bin.test.ts`, then the Vitest process did not exit while broad `tests/cli.test.ts` subprocesses were still running prompt-output commands such as `complete`, `next`, or `next --out tmp/prompt.md`. The focused Phase 5 tests and build pass; the full-suite hang is recorded as an environment/test-harness issue for this run.

## Remaining Risks

- If writing archived `task.yaml` fails after the directory rename, the task files have already moved. The implementation preflights status and destination collision before mutation, matching the existing filesystem style.
- `HEAD` is not cleared when closing a task. Phase 5 does not define HEAD cleanup; existing active lookup semantics report the closed task as unavailable.

## Post-Implementation Review

- `spec_verifier`: no blockers; Phase 5 coverage complete.
- `refactor_guard`: allowed; no scope drift reported.
- `build_validator`: no blockers; `pnpm build` and focused Phase 5 tests are sufficient for build safety.
- Safe refactor phase: no additional refactor applied because the implementation is already narrow and local.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/46
- Branch: `agent/issue-45-update-5`
- Initial implementation commit: `05550a594af0aa166dbca09b98d1b17832631724`
- Reusable agent guidance: no new guidance needed; existing Phase 5 rules and AGENTS.md constraints were sufficient.
