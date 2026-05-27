# Issue 239 current-task rejects completed HEAD

## Scope

Reject completed HEAD tasks from the read-only current task summaries:

- `playspec current-task`
- deprecated `playspec current`

Keep active-task output, missing HEAD behavior, archive behavior, and unrelated lifecycle commands unchanged.

## Use Case Alignment

After a task is completed, `.playspec/HEAD` can still point at that task. Operators using `current-task` should not see that completed record presented as the active work item. They should receive the same non-active-task error used by `use`, `prompt`, `next`, `phase`, and related lifecycle-sensitive paths.

## High-Level Current Implementation Summary

Verified behavior:

- `src/cli/commands/current-task.ts` creates a `YamlTaskStore`, resolves the task through `ActiveTaskResolver.resolveTask()`, resolves workflow phase display metadata, then prints the task summary.
- `src/cli/commands/current.ts` follows the same path after writing a deprecation warning to stderr.
- `ActiveTaskResolver.resolveTask()` only reads `.playspec/HEAD` and loads the task record. It intentionally does not enforce lifecycle state.
- `TaskNotActiveError` already provides the standard error message and hint.

Inferred behavior:

- The top-level CLI error handler converts `TaskNotActiveError` into a non-zero exit code and prints the error and hint consistently with existing command tests.

## Relevant Files Reviewed

- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `src/core/active-task-resolver.ts`
- `src/core/errors.ts`
- `src/cli/commands/next.ts`
- `tests/cli.test.ts`

## Active Entry Points And Bypasses

Active entry points:

- `playspec current-task` via `runCurrentTask(workspaceRoot)`
- deprecated `playspec current` via `runCurrent(workspaceRoot)`

Bypasses:

- `ActiveTaskResolver.resolveTask()` should remain a resolver only, per issue scope.
- `get-task <taskId>` remains the explicit inspection path for completed tasks.
- Missing or empty HEAD continues to flow through `NoActiveTaskError`.

## Current Architecture

The existing command pattern for lifecycle-sensitive commands is:

1. Resolve task through `ActiveTaskResolver`.
2. Check `task.status !== 'active'`.
3. Throw `TaskNotActiveError(task.id, task.status)`.
4. Continue command-specific rendering only for active tasks.

`current-task` and `current` currently skip step 2.

## Verified Behavior

- Existing tests already cover active `current-task` metadata output for mono-spec gate and next-route display.
- Existing tests cover completed-task rejection for `use`, `prompt`, `next`, `specs`, `phase`, rollback, and desync paths.
- No current/current-task test currently marks HEAD completed and expects rejection.

## Problems

- A completed HEAD task can be printed with `Status: completed`, making it look like selected active work.
- Deprecated `current` can drift from `current-task` unless both command paths receive the same active-status guard.

## Proposed Direction

Add the minimal guard in both CLI commands immediately after `resolveTask()`:

```ts
if (task.status !== 'active') {
  throw new TaskNotActiveError(task.id, task.status);
}
```

Import `TaskNotActiveError` from `#core/errors.js`.

## File-By-File Plan

- `src/cli/commands/current-task.ts`: add `TaskNotActiveError` import and active-status guard before workflow/phase display resolution.
- `src/cli/commands/current.ts`: add the same guard after the deprecation warning and task resolution.
- `tests/cli.test.ts`: add focused CLI regression tests for completed HEAD rejection in `current-task` and deprecated `current`.

## Risks / Open Questions

- Risk: users who used `current-task` to inspect completed tasks must switch to `get-task <taskId>`. This is accepted by the issue.
- Open question: none for the scoped fix.

## Reader Aids

Standard expected error:

```text
Task "<taskId>" is not active (status: completed).
Hint: Switch HEAD to an active task with `playspec use <TASK_ID>` or pass an active task with `--task <TASK_ID>`.
```
