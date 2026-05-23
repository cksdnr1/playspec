# Issue 148 Implementation Plan

## Ordered Steps

1. Add selected-task HEAD clearing to `src/cli/commands/close.ts`.
   - Before archiving, read `.playspec/HEAD` through `getHeadPath(workspaceRoot)` and `readTextFile()`.
   - Treat a missing or unreadable HEAD file as no selected task for this command.
   - After `core.closeTask(taskId)` succeeds, compare `headContent.trim()` to the closed `taskId`.
   - If equal, write an empty string to HEAD with `writeTextFile()`.
   - Print deterministic output after the archive path, including that HEAD was cleared and that another active task can be selected with `playspec use <TASK_ID>`.

2. Preserve existing failure behavior.
   - Do not clear or rewrite HEAD before archive succeeds.
   - Let `TaskNotCompletedError`, `ArchivedTaskAlreadyExistsError`, and `TaskNotFoundError` continue to propagate through the existing CLI error handler.
   - Do not add archive fallback to `ActiveTaskResolver`, `YamlTaskStore.getTask()`, or core close logic.

3. Add CLI regressions in `tests/integration/init-create-next.test.ts`.
   - Selected completed task case:
     - initialize workspace,
     - create a task,
     - mark it completed,
     - write that task ID to `.playspec/HEAD`,
     - run `playspec close --task <taskId>`,
     - assert close succeeds, output states HEAD was cleared, and HEAD file content is empty,
     - run `playspec current-task` and assert it fails with `No active task set.` rather than `Task not found: <taskId>`.
   - Different completed task case:
     - create one active HEAD task and one completed task,
     - close the completed non-HEAD task,
     - assert HEAD still contains the active task ID,
     - assert `playspec current-task` still reports the active task.

4. Run focused and broad validation.
   - Focused: `pnpm test -- tests/integration/init-create-next.test.ts`.
   - Broad: `pnpm test`.
   - Build: `pnpm build`.

## Files To Edit

- `src/cli/commands/close.ts`
- `tests/integration/init-create-next.test.ts`

## Tests To Add Or Update

- Add a regression that closing the selected completed task clears HEAD and gives actionable post-close behavior.
- Add a regression that closing a different completed task does not disturb the selected active task.
- Existing close/archive tests should continue to pass unchanged.

## Old Paths And Bypasses

- Direct storage archive calls remain storage-only and do not mutate HEAD.
- Core close remains storage-only and does not read global HEAD.
- HEAD-based commands still resolve only active tasks through `ActiveTaskResolver`.
- Archived tasks are not made selectable through HEAD.

## Risks

- Emptying HEAD changes the literal HEAD file content after closing the selected task, but the prior value pointed at unusable archived storage.
- Reading HEAD before close and clearing after close avoids mutating HEAD on close failures.
- The close command is hidden but used by automation; output should be explicit but not noisy.

## Rollback Notes

- Reverting the CLI close change restores the previous behavior.
- Test-only changes are isolated to the integration suite.
- No archive storage format or task schema migration is involved.

## Completion Criteria

- `playspec close --task <selectedCompletedTask>` clears `.playspec/HEAD` after successful archive and prints a recovery hint.
- `playspec current-task` after that close follows the normal no-active-task path.
- Closing a non-HEAD completed task preserves the existing active HEAD task.
- Focused integration tests, full test suite, and build pass.
