# Implementation Plan

## Ordered Steps

1. Add the core lifecycle guard.
   - Edit `src/core/playspec-core.ts`.
   - In `renderNextPrompt()`, call `this.assertTaskIsActive(task)` immediately after `taskStore.getTask(taskId)`.
   - In `renderExplicitPhasePrompt()`, call `this.assertTaskIsActive(task)` immediately after `taskStore.getTask(taskId)`.
   - Keep existing CLI HEAD guards unchanged.

2. Add CLI regression tests for explicit completed task IDs.
   - Edit `tests/cli.test.ts`.
   - Create an active task and a second completed task with workflow `mono-spec`.
   - Assert these fail with `TaskNotActiveError` text:
     - `playspec prompt --task <completed-task-id> --no-copy`
     - `playspec next --task <completed-task-id>`
     - `playspec phase 1 --task <completed-task-id>`
   - Use existing helpers `createActiveTask()`, `createAdditionalActiveTask()`, and `YamlTaskStore.updateTask()`.

3. Add or update core render-helper coverage.
   - Prefer `tests/integration/init-create-next.test.ts` because it already exercises `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()`.
   - Add completed-task assertions for both core render helpers.
   - Add archived-status assertions using a small in-test `TaskStore` wrapper if needed, since `YamlTaskStore.getTask()` does not load archived storage through `getTask()`.

4. Run focused validation.
   - `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`
   - `pnpm build`

5. Run full validation if focused validation passes.
   - `pnpm test`

## Files to Edit

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/result.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/pr.md`

## Old Paths and Bypass Paths to Close

- Explicit CLI task option bypass:
  - `prompt --task <completed>`
  - `next --task <completed>`
  - `phase <phase> --task <completed>`
- Direct core calls:
  - `PlaySpecCore.renderNextPrompt(completedOrArchivedTaskId)`
  - `PlaySpecCore.renderExplicitPhasePrompt(completedOrArchivedTaskId, phaseId)`

## Risks

- Completed tasks can no longer be used as a reference prompt rendering source. This is intentional for active workflow rendering.
- Archived tasks usually fail through active storage lookup in the YAML store; core coverage should still verify the lifecycle guard for an archived task record returned by any `TaskStore`.

## Rollback Notes

- Revert the two `assertTaskIsActive()` calls and the added tests/docs if this lifecycle boundary must be relaxed.
- No data migration or persistent task format change is planned.

## Completion Criteria

- Core render helpers reject completed and archived task records with `TaskNotActiveError`.
- CLI explicit completed-task regressions fail with the active-task error.
- Active explicit task rendering remains covered by existing tests and continues to pass.
- HEAD-based completed-task rejection remains covered and passing.
- Focused and full repository validation pass.
