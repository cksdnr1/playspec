# Issue 253 Complete Completed-Task Guard Spec

## Scope

Fix `playspec complete` so completed tasks are rejected before normal command output or completion side effects. The change is limited to the CLI ordering in `src/cli/commands/complete.ts` plus CLI regression tests in `tests/cli.test.ts`.

Out of scope: redesigning `ActiveTaskResolver`, changing `PlaySpecCore.completePhase()` safety checks, changing gate routing, prompt rendering, rollback safe points, or unrelated lifecycle commands.

## Use Case Alignment

Automation treats stdout from lifecycle commands as successful task context. For a completed task, `playspec complete` must fail cleanly without printing the task context header, whether the completed task is selected through HEAD or through `--task <id>`.

## Current Implementation Summary

Verified behavior:

- `runComplete()` resolves a task with `ActiveTaskResolver.resolveTask()`.
- Before this fix, it printed `formatContextHeader(task)` unless `--quiet` was set.
- `PlaySpecCore.completePhase()` performs the durable active-status check through `TaskNotActiveError`.
- `runPrompt()` already performs the CLI active-status check before printing its context header.

## Relevant Files Reviewed

- `src/cli/commands/complete.ts`
- `src/cli/commands/prompt.ts`
- `src/core/playspec-core.ts`
- `src/core/errors.ts`
- `tests/cli.test.ts`

## Active Entry Points and Bypasses

Both HEAD-based resolution and explicit `--task <id>` resolution flow through `runComplete()`. A single guard immediately after task resolution covers both paths before context output, gate selection, interactive prompts, and completion side effects.

## Proposed Direction

Add this guard immediately after task resolution in `runComplete()`:

```ts
if (task.status !== 'active') {
  throw new TaskNotActiveError(task.id, task.status);
}
```

Import `TaskNotActiveError` from `#core/errors.js`, matching the neighboring `prompt` command pattern. Keep the core guard unchanged.

## File-by-File Plan

`src/cli/commands/complete.ts`

- Import `TaskNotActiveError`.
- Throw before `formatContextHeader(task)`, gate result lookup, or `core.completePhase()`.

`tests/cli.test.ts`

- Add HEAD-based completed-task regression coverage for `playspec complete`.
- Add explicit completed-task regression coverage for `playspec complete --task <id>`.
- Assert non-zero exit, no context header in stdout, and the standard non-active-task message plus recovery hint.

## Risks

Low compatibility risk: callers that depended on partial context stdout before a failed completed-task `complete` will stop receiving it. This matches the issue acceptance criteria and neighboring lifecycle command behavior.
