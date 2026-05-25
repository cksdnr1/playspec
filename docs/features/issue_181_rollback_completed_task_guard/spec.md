# Issue 181 rollback completed task guard

## Scope

Reject completed or otherwise non-active tasks before any rollback preview or execution path can inspect rollback state, mutate task state, quarantine artifacts, or invoke Git restore.

In scope:

- `playspec rollback` preview for HEAD and explicit `--task`.
- `playspec rollback --state-only` for HEAD and explicit `--task`.
- `playspec rollback --git-only --confirm` for HEAD and explicit `--task`.
- Shared core behavior used by CLI and MCP rollback tools.
- CLI regression tests for completed task rejection and state-only non-mutation.

Out of scope:

- Redesigning rollback safety policy.
- Changing safe-point structure, task snapshot loading, artifact quarantine layout, or Git safety checks.
- Changing archived task storage.
- Altering unrelated lifecycle commands.

## Use Case Alignment

Rollback is a lifecycle recovery operation for an active task. A task with `status: completed` is terminal and should not be mutable through rollback, whether selected as HEAD or with `--task`.

The intended user-visible behavior is the existing lifecycle safety error:

```text
Task "<taskId>" is not active (status: completed).
```

## High-Level Current Implementation Summary

Verified behavior:

- `src/cli/commands/rollback.ts` resolves either HEAD or explicit `--task` through `ActiveTaskResolver`.
- The rollback CLI then calls `PlaySpecCore.planRollback()`, `rollbackStateOnly()`, or `executeGitRollback()` with the resolved task ID.
- `PlaySpecCore` loads the task in all three rollback methods, but does not call its existing `assertTaskIsActive()` helper before delegating to `RollbackManager`.
- `RollbackManager.rollbackStateOnly()` writes `task.yaml` from the rollback safe-point snapshot and quarantines later artifacts.
- `RollbackManager.executeGitRollback()` calls `plan()` and can invoke `git restore --source <safePointGitHead> -- <targetFiles>` when safety gates pass.
- Nearby lifecycle operations in `PlaySpecCore`, including prompt rendering, context mutation, phase completion, phase setting, evidence, snapshots, harness operations, and task link mutation, call `assertTaskIsActive()`.

Inferred behavior:

- Adding the guard in `PlaySpecCore` before the rollback manager calls will reject both CLI and MCP rollback paths, because MCP also calls these core rollback methods.
- The guard must be before `RollbackManager.plan()` for preview, before `RollbackManager.rollbackStateOnly()` for task/artifact mutation, and before `RollbackManager.executeGitRollback()` for Git restore.

## Relevant Files Reviewed

- `src/cli/commands/rollback.ts`: CLI rollback mode selection and task resolution.
- `src/cli/index.ts`: hidden rollback command wiring and error handling.
- `src/core/playspec-core.ts`: rollback core methods and existing `assertTaskIsActive()` helper.
- `src/core/rollback-manager.ts`: rollback preview, state-only write/quarantine behavior, and Git rollback execution.
- `src/core/errors.ts`: `TaskNotActiveError` message and hint.
- `src/mcp/server.ts`: MCP rollback tools delegate to core rollback methods.
- `tests/cli.test.ts`: existing CLI rollback tests and workspace helpers.

## Active Entry Points and Bypasses

Active entry points:

- `playspec rollback`
- `playspec rollback --task <taskId>`
- `playspec rollback --state-only`
- `playspec rollback --state-only --task <taskId>`
- `playspec rollback --git-only --confirm`
- `playspec rollback --git-only --confirm --task <taskId>`
- MCP `playspec_plan_rollback`
- MCP `playspec_rollback_state`
- MCP `playspec_execute_git_rollback`

Bypass:

- All rollback paths bypass active-task validation today because the shared core rollback boundary only loads the task and delegates to `RollbackManager`.

## Current Architecture

Verified flow:

```text
CLI rollback
  -> ActiveTaskResolver.resolveTask(optional --task)
  -> PlaySpecCore rollback method
  -> taskStore.getTask(taskId)
  -> RollbackManager plan/state-only/git-only
```

Proposed flow:

```text
CLI or MCP rollback
  -> PlaySpecCore rollback method
  -> taskStore.getTask(taskId)
  -> assertTaskIsActive(task)
  -> RollbackManager plan/state-only/git-only
```

## Verified Behavior

- Active-task rollback preview prints safe-point and Git eligibility details.
- Active-task state-only rollback restores `task.yaml` from the last safe point and quarantines future artifacts.
- Active-task confirmed Git rollback preserves existing safety gates for dirty tracked files, post-safe-point commits, untracked conflicts, and branch divergence.
- Completed tasks are rejected by many nearby lifecycle commands through `TaskNotActiveError`, but rollback currently lacks the same guard.

## Problems

- Completed HEAD rollback can preview terminal task rollback state.
- Completed HEAD rollback with `--state-only` can rewrite a completed task file and move artifacts into rollback quarantine.
- Completed HEAD rollback with `--git-only --confirm` can reach Git restore after safety checks.
- The same behavior is available through explicit `--task`.
- CLI-only validation would leave MCP callers inconsistent, so the guard belongs at the core rollback boundary.

## Proposed Direction

Add `this.assertTaskIsActive(task)` in:

- `PlaySpecCore.planRollback()`
- `PlaySpecCore.rollbackStateOnly()`
- `PlaySpecCore.executeGitRollback()`

Keep `RollbackManager` focused on rollback mechanics and safety checks. Do not change the rollback plan shape, state snapshot restoration, artifact quarantine logic, or Git restore logic.

## File-by-File Plan

- `src/core/playspec-core.ts`: add the active-task assertion immediately after loading the task in all three rollback methods.
- `tests/cli.test.ts`: add CLI regression coverage that creates a task with a rollback safe point, completes it, and verifies:
  - `playspec rollback` fails for completed HEAD with `TaskNotActiveError` wording.
  - `playspec rollback --state-only` fails for completed HEAD and leaves `task.yaml`, active snapshot artifacts, and rollback quarantine unchanged.
  - `playspec rollback --git-only --confirm` fails for completed HEAD before Git rollback behavior.
  - explicit `--task <completedTaskId>` is rejected for rollback preview.
- Existing active-task rollback tests should remain unchanged and passing.

## Risks and Open Questions

- Risk: users may have used rollback as an undocumented recovery path after completion. The issue explicitly defines the policy as active-only, so the implementation should prefer the existing lifecycle safety error over silent terminal task mutation.
- Risk: a failed regression test that asserts no quarantine mutation must inspect the task file and artifact locations before and after invoking state-only rollback.
- Open question: whether archived tasks should get separate rollback messaging. This issue excludes archived storage changes, so no new behavior is planned.

## Reader Aids

The smallest behavior-preserving change is in core, not CLI:

```ts
const task = await this.taskStore.getTask(taskId);
this.assertTaskIsActive(task);
return this.rollbackManager.plan(task);
```

This keeps HEAD and explicit `--task` behavior aligned, and makes CLI and MCP callers share the same lifecycle boundary.
