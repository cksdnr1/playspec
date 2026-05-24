# Implementation Plan: desync-check completed task active guard

## Ordered Steps

1. Add the core lifecycle guard.
   - Edit `src/core/playspec-core.ts`.
   - In `checkTaskDesync(taskId)`, load the task as today, then call `this.assertTaskIsActive(task)` before `this.stateDesyncDetector.run(task)`.
   - This keeps HEAD-based CLI, explicit `--task` CLI, and MCP callers behind one consistent boundary.

2. Add HEAD-based CLI regression coverage.
   - Edit `tests/cli.test.ts` near the existing desync-check tests.
   - Create a task, mark it completed through the existing store helper/update path, leave `.playspec/HEAD` pointing at it, then run `desync-check`.
   - Assert exit code `1`, stderr contains `Task "<id>" is not active (status: completed).`, and stderr includes the existing hint to use an active task.

3. Add explicit `--task` CLI regression coverage.
   - Create an active HEAD task and a second completed task.
   - Run `desync-check --task <completedTaskId>`.
   - Assert the same inactive-task error style and completed task ID/status.

4. Verify active-task behavior remains unchanged.
   - Keep existing active desync tests unchanged.
   - Run the focused CLI test file, then build and full test suite if runtime allows.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`

## Tests To Add Or Update

- Add: `rejects HEAD-based completed tasks through desync-check`.
- Add: `rejects explicit completed tasks through desync-check --task`.
- Existing tests to keep passing:
  - `reports desync details via the CLI`
  - `reports untracked files through desync-check`

## Entry Point To User-Visible Behavior Trace

HEAD path:

1. `playspec desync-check`
2. `ActiveTaskResolver.resolveTask(undefined)` resolves `.playspec/HEAD`.
3. `PlaySpecCore.checkTaskDesync(task.id)` loads the task.
4. `assertTaskIsActive()` throws `TaskNotActiveError` for `completed`.
5. CLI prints the existing error message and hint.

Explicit task path:

1. `playspec desync-check --task <completedTaskId>`
2. `ActiveTaskResolver.resolveTask(completedTaskId)` resolves the explicit task.
3. `PlaySpecCore.checkTaskDesync(task.id)` loads the task.
4. `assertTaskIsActive()` throws `TaskNotActiveError`.
5. CLI prints the existing error message and hint.

Active path:

1. `playspec desync-check` resolves an active task.
2. `assertTaskIsActive()` passes.
3. `StateDesyncDetector.run(task)` produces the existing desync output.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `checkTaskDesync()` directly called `StateDesyncDetector.run()` for any task status.
- Bypass closed: direct core callers, including MCP, now receive the same guard as CLI.
- Partial migration risk: adding the guard only in `src/cli/commands/desync-check.ts` would leave MCP and future core callers unguarded. The implementation must be in core.

## Risks

- Compatibility: completed tasks that previously returned desync details will now fail. This is the intended behavior.
- Test setup: use existing task store helpers and status update patterns to avoid brittle direct YAML edits.

## Rollback Notes

- Reverting the one-line core guard restores prior behavior.
- The added tests should be reverted with the guard if the behavior is intentionally relaxed later.

## Completion Criteria

- HEAD-based completed task rejection test passes.
- Explicit `--task` completed task rejection test passes.
- Existing active-task desync tests pass without output changes.
- `pnpm build` and `pnpm test` pass.
