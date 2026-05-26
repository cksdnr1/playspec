# Implementation Plan: specs --task active guard

## Ordered Steps

1. Add the failing regression in `tests/cli.test.ts`.
   - Place it next to the existing specs tests.
   - Create an active mono-spec task and write `docs/features/<taskId>/spec.md`.
   - Mark the task `completed` through `YamlTaskStore.updateTask()`.
   - Run `playspec specs --task <taskId> --path-only` in non-interactive mode.
   - Assert exit code `1`, stderr contains `Task "<taskId>" is not active`, stderr contains the existing active-task recovery hint, and stdout does not include the relevant spec path.

2. Update `src/cli/commands/specs.ts`.
   - After `resolver.resolveTask(opts.task)`, reject every non-active task with `TaskNotActiveError`.
   - Keep the guard before workflow loading and `discoverRelevantFiles()` so rejected completed tasks cannot emit warnings or relevant paths.

3. Run focused validation.
   - Run the focused CLI specs tests first.
   - Run the broader repository validation that is practical for this change: `pnpm build` and `pnpm test`.

## Files To Edit

- `src/cli/commands/specs.ts`: change the active-task guard.
- `tests/cli.test.ts`: add the completed explicit task regression.
- `docs/features/issue_223_specs_task_active_guard/result.md`: implementation result in a later phase.
- `docs/features/issue_223_specs_task_active_guard/pr.md`: PR summary in a later phase.

## Tests To Add Or Update

- Add a CLI regression for `specs --task <completedTaskId> --path-only`.
- Preserve the existing `resolves specs --task without changing HEAD` test for active explicit tasks.
- Existing specs tests for `--print`, binary/large files, missing paths, and interactive selection should continue to pass unchanged.

## Entry Point Trace

User command `playspec specs --task <id> --path-only` -> CLI calls `runSpecs()` -> `ActiveTaskResolver.resolveTask(<id>)` loads the task -> new unconditional active guard rejects completed status -> CLI error handler prints `TaskNotActiveError` and hint -> no workflow phase resolution, relevant-file discovery, or stdout path emission occurs.

## Old Paths And Bypasses To Close

- Old path: only HEAD-based `specs` rejected completed tasks.
- Bypass: explicit `--task` skipped the active guard.
- Closure: apply the same active check to all resolved tasks inside `runSpecs()`.

## Risks

- Intentional compatibility break for users inspecting completed task files through `specs --task`.
- Low implementation risk because the existing error type and active guard are already imported and used in the same file.

## Rollback Notes

Reverting the `specs.ts` guard change and the new test restores the prior explicit completed-task behavior. No migration, archive, storage format, or task data changes are involved.

## Completion Criteria

- Completed explicit `specs --task` exits non-zero before relevant paths are printed.
- Error message and recovery hint come from `TaskNotActiveError`.
- Active explicit `specs --task` still works and does not change HEAD.
- HEAD-based completed-task rejection remains intact.
- Focused specs tests, build, and full test suite pass.
