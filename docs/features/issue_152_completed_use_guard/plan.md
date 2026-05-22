# Issue 152 Completed Use Guard Plan

## Goal

Prevent explicit `playspec use <taskId>` from selecting completed tasks into `.playspec/HEAD`, while preserving active-task selection and existing interactive behavior.

## Ordered Implementation Steps

1. Update `src/cli/commands/use.ts`.
   - Add `TaskNotActiveError` to the existing error import from `#core/errors.js`.
   - In `setHeadToTask()`, after `task = await store.getTask(taskId)` succeeds and before `writeTextFile(getHeadPath(...))`, check `task.status`.
   - If `task.status !== 'active'`, throw `new TaskNotActiveError(taskId, task.status)`.
   - Leave the `TaskNotFoundError` suggestion path unchanged.
   - Leave the no-argument interactive path unchanged; it already uses `store.listActiveTasks()`.

2. Add CLI regression coverage in `tests/cli.test.ts`.
   - Place the test next to existing `use` command tests.
   - Create an active HEAD task with `createActiveTask()`.
   - Create another active task with `createAdditionalActiveTask()`, then mark it completed via `YamlTaskStore.updateTask(completedTaskId, { status: 'completed', currentPhase: null })`.
   - Run `runCli(['use', completedTaskId], workspace.dir)`.
   - Assert:
     - exit code is non-zero.
     - stderr contains `Task "<completedTaskId>" is not active`.
     - stderr contains an actionable active-task hint, such as `playspec use <TASK_ID>` or equivalent existing `TaskNotActiveError` text.
     - `.playspec/HEAD` remains the original active task ID.
   - Do not alter the existing explicit active-task `use <taskId>` test.

3. Run focused validation.
   - First run the focused CLI test file or filtered test:
     - `pnpm test -- tests/cli.test.ts`
   - Then run repository validation:
     - `pnpm build`
     - `pnpm test`

4. Record implementation and test results in `docs/features/issue_152_completed_use_guard/result.md` during the implementation and test phases.

## Files To Edit

- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `docs/features/issue_152_completed_use_guard/result.md`
- `docs/features/issue_152_completed_use_guard/pr.md` during PR prep

## Behavior Chain

Active task path:

- User runs `playspec use <activeTaskId>`.
- `runUse()` calls `setHeadToTask()`.
- `store.getTask(activeTaskId)` returns a task with `status: active`.
- Guard passes.
- `.playspec/HEAD` is updated.
- CLI prints `HEAD set to:` and current-task summary.

Completed task path:

- User runs `playspec use <completedTaskId>`.
- `runUse()` calls `setHeadToTask()`.
- `store.getTask(completedTaskId)` returns a task with `status: completed`.
- Guard throws before writing `.playspec/HEAD`.
- CLI exits non-zero and prints the not-active lifecycle error plus recovery hint.
- Existing HEAD remains unchanged.

Interactive no-argument path:

- User runs `playspec use` in an interactive terminal.
- `runUse()` calls `store.listActiveTasks()`.
- Completed tasks are excluded before selection.
- Existing behavior remains unchanged.

## Old Paths And Bypasses Closed

- Closed: explicit `setHeadToTask()` no longer treats active-storage existence as enough to mutate HEAD.
- Preserved: missing task IDs still use `throwUseSuggestionError()` and active-task suggestions.
- Preserved: no-argument use remains based on `listActiveTasks()`.

## Risks

- The regression should assert the lifecycle problem and recovery hint without overfitting to full error formatting.
- Reusing `TaskNotActiveError` must not imply changes to other lifecycle command routing; only `use.ts` should import and throw it.

## Rollback Notes

Reverting the `use.ts` guard and the new CLI test restores previous behavior. No schema, storage, migration, archive, or MCP data changes are involved.

## Completion Criteria

- `playspec use <activeTaskId>` still succeeds and prints the current-task summary.
- `playspec use <completedTaskId>` fails non-zero.
- Failed completed-task selection does not change `.playspec/HEAD`.
- Error output says the task is not active and includes an active-task recovery hint.
- Existing interactive use tests still pass.
- Existing completed HEAD lifecycle rejection tests still pass.
- `pnpm build` and `pnpm test` pass.
