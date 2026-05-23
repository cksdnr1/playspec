# Implementation Plan

## Goal

Make explicit phase-execution creation reject non-completed planning tasks before artifact resolution, execution task creation, or HEAD mutation.

## Ordered Steps

1. Add a phase-execution-specific error.
   - File: `src/core/errors.ts`
   - Add `PlanningTaskNotCompletedError`.
   - Message: `Planning task "<taskId>" is not completed (status: <status>).`
   - Hint: `Phase-execution creation requires a completed planning task. Complete the planning task first, then rerun with --from <TASK_ID>.`

2. Guard explicit `--from` in phase-execution creation.
   - File: `src/cli/commands/create.ts`
   - Import `PlanningTaskNotCompletedError`.
   - Replace the current `planningTaskId`-only selection with a `planningTask` variable.
   - For `options.from`, call `store.getTask(options.from)` and immediately check `planningTask.status === 'completed'`.
   - Throw `PlanningTaskNotCompletedError` before `resolvePlanningArtifacts()`.
   - For no-`--from`, preserve `store.listCompletedTasks()` matching, ambiguity handling, and interactive selection, then load the selected task as today.

3. Add the CLI regression.
   - File: `tests/cli.test.ts`
   - Add a test near existing phase-execution create tests.
   - Setup:
     - Initialize default workspace.
     - Create a normal active HEAD task and record `.playspec/HEAD`.
     - Create an active `total-plan` planning task with phase history resolving the total spec and phase plan artifact names.
     - Write both expected artifact files.
   - Execute:
     - `playspec create "Active Planning Task" --workflow issue-scope-create --phase 1 --from active_planning_task`
   - Assert:
     - exit code is `1`.
     - stderr says the planning task is not completed.
     - stderr says phase-execution creation requires a completed planning task.
     - `.playspec/tasks/active/active_planning_task_phase_1_execution/task.yaml` does not exist.
     - HEAD remains the original active task.

4. Verify completed explicit source still succeeds.
   - Existing test `stores workflow variables when creating a phase-execution task` already creates a completed `total-plan` task with artifacts and uses explicit `--from`.
   - Keep it passing; do not weaken its assertions.

5. Run validation.
   - `pnpm build`
   - `pnpm test`

## Old Paths And Bypasses To Preserve

- Normal create without `--phase`: `--from` remains a source problem file alias.
- Phase-execution without `--from`: still uses `store.listCompletedTasks()`, title matching, ambiguity handling, and interactive selection behavior.
- Completed source with missing artifacts: still reaches `PlanningContextNotFoundError`.

## Risks

- A local script relying on active planning sources will now fail. This is intended by the issue and matches completed-only automatic discovery.
- Reusing `TaskNotCompletedError` would produce archive-specific guidance, so the new error avoids confusing user-facing text.

## Rollback Notes

The change is limited to one new error class, one CLI guard, and one regression test. Reverting those edits restores the prior explicit `--from` behavior.

## Completion Criteria

- Active explicit planning source fails before artifact binding side effects.
- No execution task is created and HEAD does not change on rejection.
- Completed explicit planning source with valid artifacts still succeeds.
- Existing missing artifact and no-`--from` behavior remains unchanged.
- Build and test commands pass.
