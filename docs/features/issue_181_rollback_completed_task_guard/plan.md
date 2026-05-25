# Issue 181 rollback completed task guard plan

## Ordered Implementation Steps

1. Add active-task validation in `src/core/playspec-core.ts`.
   - In `planRollback(taskId)`, call `this.assertTaskIsActive(task)` immediately after `taskStore.getTask(taskId)`.
   - Repeat the same guard in `rollbackStateOnly(taskId)` and `executeGitRollback(taskId)`.
   - Do not change `RollbackManager` behavior or result types.

2. Add CLI regression coverage in `tests/cli.test.ts`.
   - Add helper setup inside the rollback test area that:
     - Creates an active task.
     - Writes `src/app.ts`.
     - Initializes Git.
     - Runs `playspec complete` to create a rollback safe point.
     - Runs `playspec snapshot` so there is a post-safe-point artifact that state-only rollback would normally quarantine.
     - Updates the task status to `completed` through `YamlTaskStore`.
   - Test `playspec rollback` for completed HEAD.
   - Test `playspec rollback --state-only` for completed HEAD and assert no task file or artifact movement occurred.
   - Test `playspec rollback --git-only --confirm` for completed HEAD.
   - Test explicit `--task <completedTaskId>` rejection for preview.

3. Preserve active rollback behavior.
   - Do not edit existing active rollback tests except where needed for helper reuse.
   - Keep dirty worktree, new commit, untracked conflict, and clean Git rollback expectations unchanged.

4. Run validation.
   - Inspect `package.json` scripts.
   - Run `pnpm build`.
   - Run focused CLI tests for rollback if practical.
   - Run `pnpm test` before commit.

## Files to Edit

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `docs/features/issue_181_rollback_completed_task_guard/result.md`
- `docs/features/issue_181_rollback_completed_task_guard/pr.md`

## Behavior Trace

Preview:

```text
playspec rollback
  -> ActiveTaskResolver resolves HEAD or --task
  -> PlaySpecCore.planRollback(task.id)
  -> taskStore.getTask
  -> assertTaskIsActive
  -> RollbackManager.plan only for active tasks
  -> preview output
```

State-only:

```text
playspec rollback --state-only
  -> PlaySpecCore.rollbackStateOnly(task.id)
  -> taskStore.getTask
  -> assertTaskIsActive
  -> RollbackManager.rollbackStateOnly only for active tasks
  -> task.yaml write/quarantine only for active tasks
```

Git-only:

```text
playspec rollback --git-only --confirm
  -> PlaySpecCore.executeGitRollback(task.id)
  -> taskStore.getTask
  -> assertTaskIsActive
  -> RollbackManager.executeGitRollback only for active tasks
  -> existing Git safety gates and restore logic
```

## Old Paths, Bypasses, and Partial Migration Risks

- Old path: CLI resolves HEAD and explicit `--task`, then invokes core rollback without an active-task check.
- Bypass: explicit `--task` reaches the same unguarded core methods as HEAD.
- Partial migration risk: adding a CLI-only guard would leave MCP rollback tools unguarded. The implementation must guard in `PlaySpecCore`.
- Partial migration risk: guarding only state-only or git-only would still allow preview of completed rollback state. All three core methods must be guarded.

## Tests to Add or Update

- Completed HEAD preview:
  - Command: `rollback`
  - Expected: exit code `1`, stderr contains `Task "<taskId>" is not active (status: completed).`

- Completed HEAD state-only:
  - Command: `rollback --state-only`
  - Expected: exit code `1`, same stderr.
  - Non-mutation assertions:
    - `task.yaml` contents are unchanged.
    - The post-safe-point snapshot remains in active `snapshots/`.
    - The rollback quarantine path for that snapshot is absent.

- Completed HEAD confirmed Git:
  - Command: `rollback --git-only --confirm`
  - Expected: exit code `1`, same stderr.

- Explicit completed task:
  - Command: `rollback --task <taskId>`
  - Expected: exit code `1`, same stderr.

Existing tests for active rollback must remain passing.

## Risks

- The task store update used to mark a task completed should preserve rollback metadata. Use the existing store update path rather than rewriting YAML by hand.
- The state-only non-mutation test should read the raw `task.yaml` before and after command execution to avoid false confidence from parsed object normalization.
- Build/test runtime may be non-trivial, but full test validation is required before PR.

## Rollback Notes

The code change is limited to three guard calls and can be reverted by removing those calls. Test additions are isolated to CLI rollback coverage.

## Completion Criteria

- Completed rollback preview, state-only, git-only, and explicit-task paths reject with `TaskNotActiveError`.
- State-only rejection leaves completed task files and artifacts unchanged.
- Existing active rollback behavior remains unchanged.
- `pnpm build` and `pnpm test` pass.
