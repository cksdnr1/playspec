# Issue 253 Implementation Plan

## Ordered Steps

1. Add the early completed-task guard in `src/cli/commands/complete.ts`.
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - After `const task = await resolver.resolveTask(taskIdOption);`, check `task.status`.
   - Throw `new TaskNotActiveError(task.id, task.status)` when the task is not active.
   - Keep the existing `PlaySpecCore.completePhase()` guard unchanged.

2. Add CLI regression coverage in `tests/cli.test.ts`.
   - Add a HEAD-based test near existing completion tests.
   - Add an explicit `--task <id>` test near the same completion block.
   - Mark target tasks `status: completed` and `currentPhase: null`.
   - Assert non-zero exit, standard error message, standard recovery hint, and no task context header in stdout.

3. Validate active behavior remains unchanged.
   - Run focused CLI completion tests while iterating.
   - Run repository build and full test suite before commit.

## Files To Edit

- `src/cli/commands/complete.ts`
- `tests/cli.test.ts`

## Tests To Add

- `playspec complete` rejects a completed HEAD task before printing `Task: ...`.
- `playspec complete --task <completed-task-id>` rejects before printing `Task: ...`.

## Bypass Paths

HEAD-based task resolution and explicit `--task` resolution both flow through `runComplete()`, so the guard closes both. Core rejection remains in place for non-CLI callers and as defense in depth.

## Completion Criteria

- Completed HEAD task: `playspec complete` exits non-zero and stdout does not contain the context header.
- Explicit completed task: `playspec complete --task <id>` exits non-zero and stdout does not contain the context header.
- Error text includes the standard non-active-task message and active-task recovery hint.
- Active completion tests still pass.
- `pnpm build` and `pnpm test` pass.
