# Issue 161 prompt task active guard

## Scope

Fix normal prompt generation commands so completed tasks are rejected immediately even when selected with an explicit `--task` option. The change applies to `playspec prompt` and the deprecated `playspec next` command only.

Out of scope: task lifecycle redesign, archive behavior, read-only inspection commands, removing `next`, or changing completion/phase/rewind/use behavior except for any tiny helper reuse needed by this guard.

## Use Case Alignment

Operators and automation use `playspec prompt` or `playspec next` to continue an active workflow task. A task with `status: completed` has crossed the terminal lifecycle boundary and should not produce a fresh next prompt, nor should it create prompt artifacts through `--out` or `--write`.

## High-Level Current Implementation Summary

Verified behavior:

- `src/cli/commands/prompt.ts` resolves a task through `ActiveTaskResolver`, but only throws `TaskNotActiveError` for non-active HEAD tasks because the guard is `if (!taskIdOption && task.status !== 'active')`.
- `src/cli/commands/next.ts` has the same conditional guard after printing its deprecation warning.
- `ActiveTaskResolver.resolveTask(taskId)` returns `taskStore.getTask(taskId)` directly for explicit task IDs.
- `PlaySpecCore.renderNextPrompt()` has an internal active-task assertion, so explicit completed tasks are eventually rejected, but only after the CLI path has already proceeded into desync checks.
- `TaskNotActiveError` already includes the task ID and status and provides a recovery hint for HEAD or explicit `--task` use.

Inferred behavior:

- Because prompt output writing happens after `core.renderNextPrompt()`, the current core guard likely prevents prompt artifacts in most explicit completed-task paths. The CLI still violates the requested boundary by entering pre-render prompt workflow logic before rejecting.

## Relevant Files Reviewed

- `src/cli/commands/prompt.ts`: prompt entry point, output writing, and current conditional active guard.
- `src/cli/commands/next.ts`: deprecated next entry point and current conditional active guard.
- `src/core/active-task-resolver.ts`: explicit task ID bypass of HEAD resolution.
- `src/core/playspec-core.ts`: core active-task assertion used by render helpers.
- `src/core/errors.ts`: `TaskNotActiveError` message format.
- `tests/cli.test.ts`: CLI harness and existing completed-task guard coverage.

## Active Entry Points and Bypasses

Verified active entry points:

- `playspec prompt`
- `playspec prompt --task <taskId>`
- `playspec next`
- `playspec next --task <taskId>`

Bypass:

- Explicit `--task` bypasses the CLI active guard because both command files condition the guard on the absence of `taskIdOption`.

## Current Architecture

CLI command -> `ActiveTaskResolver` -> optional CLI guard -> context/desync work -> `PlaySpecCore.renderNextPrompt()` -> output/copy/write handling.

The proposed boundary is immediately after task resolution:

CLI command -> `ActiveTaskResolver` -> active guard for all resolved tasks -> context/desync work -> render -> output.

## Verified Behavior

- HEAD-based completed prompt/next paths are rejected by the existing CLI guard.
- Explicit completed prompt/next paths currently rely on the later core render guard.
- Existing tests cover explicit completed prompt/next rejection, but they do not assert `--print-only --quiet` for `prompt` and do not prove `--out` avoids artifact creation.

## Problems

- The command-level lifecycle guard is inconsistent between HEAD and explicit task selection.
- Explicit completed task paths can run pre-render workflow checks before rejection.
- Regression coverage does not directly assert that explicit completed prompt output options leave no artifact behind.

## Proposed Direction

Change the prompt and next command guards to reject any resolved non-active task regardless of whether it came from HEAD or `--task`.

Use the existing `TaskNotActiveError` to preserve error wording and recovery hints.

Add focused CLI tests for:

- `playspec prompt --task <completedTaskId> --print-only --quiet`
- `playspec prompt --task <completedTaskId> --out <path>` with no output file written
- `playspec next --task <completedTaskId>` remains rejected

## File-by-File Plan

- `src/cli/commands/prompt.ts`: replace `if (!taskIdOption && task.status !== 'active')` with `if (task.status !== 'active')`.
- `src/cli/commands/next.ts`: make the same guard change.
- `tests/cli.test.ts`: adjust/add explicit completed-task prompt tests to cover `--print-only --quiet` and artifact prevention. Keep next explicit completed-task coverage.

## Risks and Open Questions

- Risk: users who intentionally rendered completed tasks with explicit IDs will now get a lifecycle error earlier. This matches the issue requirement.
- Open question: whether `specs` should also reject explicit completed tasks. It has the same conditional pattern, but this issue explicitly scopes only `prompt` and `next`, so leave it unchanged.

## Reader Aids

`TaskNotActiveError` currently formats the key message as:

```text
Task "<taskId>" is not active (status: completed).
```

That satisfies the required task ID/status detail without introducing a new error type.
